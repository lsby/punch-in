import { 视频混音器组件 } from './video-audio-mixer'

type 分析数据 = { 分析器: AnalyserNode; 数据: Float32Array<ArrayBuffer>; 增益: GainNode }
export type 音频轨道来源 = { 桌面音频轨道: MediaStreamTrack | null; 麦克风轨道: MediaStreamTrack | null }

export class 视频音频分析器 {
  private 音频上下文: AudioContext | null = null
  private 混音器组件: 视频混音器组件 | null = null
  private 动画帧ID: number | null = null
  private 桌面分析: 分析数据 | null = null
  private 麦克风分析: 分析数据 | null = null
  private 混音目标: MediaStreamAudioDestinationNode | null = null
  private 麦克风噪音门: AudioWorkletNode | null = null
  private 波形样本队列: number[] = []
  private 音频就绪任务: Promise<void> | null = null
  private 标记音频就绪: (() => void) | null = null

  public 设置混音器(混音器: 视频混音器组件 | null): void {
    this.混音器组件 = 混音器
    if (混音器 === null) return
    混音器.监听发出事件('音量改变', async (事件) => {
      let 分析 = 事件.detail.类型 === '桌面' ? this.桌面分析 : this.麦克风分析
      this.平滑设置增益(分析, 事件.detail.音量)
    })
    混音器.监听发出事件('静音状态改变', async (事件) => {
      let 分析 = 事件.detail.类型 === '桌面' ? this.桌面分析 : this.麦克风分析
      if (分析 === null) return
      let 音量 = 事件.detail.类型 === '桌面' ? 混音器.桌面音频音量 : 混音器.麦克风音量
      this.平滑设置增益(分析, 事件.detail.是否静音 ? 0 : 音量)
    })
    混音器.监听发出事件('门限改变', async (事件) => {
      this.麦克风噪音门?.port.postMessage(事件.detail.门限)
    })
  }

  public async 启动(来源: 音频轨道来源): Promise<void> {
    await this.停止()
    if (来源.桌面音频轨道 === null && 来源.麦克风轨道 === null) return
    this.音频就绪任务 = new Promise<void>((完成): void => {
      this.标记音频就绪 = 完成
    })
    this.音频上下文 = new AudioContext()
    let ctx = this.音频上下文
    await ctx.audioWorklet.addModule(new URL('./video-audio-worklet.ts', import.meta.url))
    this.混音目标 = ctx.createMediaStreamDestination()
    let 混音节点 = ctx.createGain()
    let 防削波器 = ctx.createDynamicsCompressor()
    防削波器.threshold.value = -6
    防削波器.knee.value = 6
    防削波器.ratio.value = 8
    防削波器.attack.value = 0.003
    防削波器.release.value = 0.15
    混音节点.connect(防削波器)
    防削波器.connect(this.混音目标)

    let 创建分析器 = (轨道: MediaStreamTrack, 初始音量: number, 初始静音: boolean, 使用噪音门: boolean): 分析数据 => {
      let source = ctx.createMediaStreamSource(new MediaStream([轨道]))
      let 增益 = ctx.createGain()
      增益.gain.value = 初始静音 ? 0 : 初始音量
      let 分析器 = ctx.createAnalyser()
      分析器.fftSize = 2048
      分析器.smoothingTimeConstant = 0.3
      if (使用噪音门) {
        this.麦克风噪音门 = new AudioWorkletNode(ctx, 'lsby-noise-gate')
        this.麦克风噪音门.port.postMessage(this.混音器组件?.麦克风门限 ?? 0.01)
        source.connect(this.麦克风噪音门)
        this.麦克风噪音门.connect(增益)
      } else source.connect(增益)
      增益.connect(分析器)
      增益.connect(混音节点)
      return { 分析器, 数据: new Float32Array(分析器.fftSize), 增益 }
    }

    if (来源.桌面音频轨道 !== null) {
      this.桌面分析 = 创建分析器(
        来源.桌面音频轨道,
        this.混音器组件?.桌面音频音量 ?? 1,
        this.混音器组件?.桌面音频静音 ?? false,
        false,
      )
    }
    if (来源.麦克风轨道 !== null) {
      this.麦克风分析 = 创建分析器(
        来源.麦克风轨道,
        this.混音器组件?.麦克风音量 ?? 1,
        this.混音器组件?.麦克风静音 ?? false,
        true,
      )
    }

    let 音量计 = new AudioWorkletNode(ctx, 'lsby-volume-meter')
    let 静音输出 = ctx.createGain()
    静音输出.gain.value = 0
    防削波器.connect(音量计)
    音量计.connect(静音输出)
    静音输出.connect(ctx.destination)
    音量计.port.onmessage = (事件: MessageEvent<number>): void => {
      this.波形样本队列.push(事件.data)
      if (this.波形样本队列.length > 6000) this.波形样本队列.splice(0, this.波形样本队列.length - 6000)
      this.标记音频就绪?.()
      this.标记音频就绪 = null
    }
    if (ctx.state === 'suspended') await ctx.resume()
    this.开始电平循环()
  }

  public async 等待音频就绪(): Promise<void> {
    let 任务 = this.音频就绪任务
    if (任务 === null) return
    await Promise.race([任务, new Promise<void>((完成): number => window.setTimeout(完成, 1000))])
    this.提取波形样本()
  }

  public 提取波形样本(): number[] {
    let 结果 = this.波形样本队列
    this.波形样本队列 = []
    return 结果
  }

  public 获得混音后的流(原始流: MediaStream): MediaStream {
    if (this.音频上下文 === null || this.混音目标 === null) return 原始流
    let 结果流 = new MediaStream()
    for (let track of 原始流.getVideoTracks()) 结果流.addTrack(track)
    for (let track of this.混音目标.stream.getAudioTracks()) 结果流.addTrack(track)
    return 结果流
  }

  public async 停止(): Promise<void> {
    if (this.动画帧ID !== null) cancelAnimationFrame(this.动画帧ID)
    this.动画帧ID = null
    this.桌面分析 = null
    this.麦克风分析 = null
    this.麦克风噪音门 = null
    this.混音目标 = null
    this.波形样本队列 = []
    this.标记音频就绪?.()
    this.标记音频就绪 = null
    this.音频就绪任务 = null
    let ctx = this.音频上下文
    this.音频上下文 = null
    if (ctx !== null && ctx.state !== 'closed') await ctx.close()
  }

  private 开始电平循环(): void {
    let 循环 = (): void => {
      if (this.音频上下文 === null) return
      let 桌面音量 = this.计算单路音量(this.桌面分析)
      let 麦克风音量 = this.计算单路音量(this.麦克风分析)
      this.混音器组件?.更新实时电平('桌面', 桌面音量)
      this.混音器组件?.更新实时电平('麦克风', 麦克风音量)
      this.动画帧ID = requestAnimationFrame(循环)
    }
    this.动画帧ID = requestAnimationFrame(循环)
  }

  private 计算单路音量(分析: 分析数据 | null): number {
    if (分析 === null) return 0
    分析.分析器.getFloatTimeDomainData(分析.数据)
    let 平方和 = 0
    for (let sample of 分析.数据) 平方和 += sample * sample
    return Math.min(1, Math.sqrt(平方和 / 分析.数据.length) * 6)
  }

  private 平滑设置增益(分析: 分析数据 | null, 目标值: number): void {
    let ctx = this.音频上下文
    if (分析 === null || ctx === null) return
    分析.增益.gain.cancelScheduledValues(ctx.currentTime)
    分析.增益.gain.setTargetAtTime(目标值, ctx.currentTime, 0.01)
  }
}
