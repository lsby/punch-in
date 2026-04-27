import { 视频混音器组件 } from './video-audio-mixer'

export class 视频音频分析器 {
  private 音频上下文: AudioContext | null = null
  private 混音器组件: 视频混音器组件 | null = null
  private 动画帧ID: number | null = null

  // 累积峰值: 在帧间持续跟踪最大 RMS，避免 AnalyserNode 快照式采样遗漏瞬时音频
  private 桌面累积峰值 = 0
  private 麦克风累积峰值 = 0

  public 当前总音量 = 0

  public 设置混音器(混音器: 视频混音器组件 | null): void {
    this.混音器组件 = 混音器
  }

  public 启动(媒体流: MediaStream): void {
    if (this.音频上下文 !== null) {
      void this.音频上下文.close()
    }
    if (this.动画帧ID !== null) {
      cancelAnimationFrame(this.动画帧ID)
      this.动画帧ID = null
    }

    this.音频上下文 = new AudioContext()
    let ctx = this.音频上下文

    // 确保 AudioContext 不会卡在 suspended 状态
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    let 创建分析器 = (stream: MediaStream): { 分析器: AnalyserNode; 数据: Float32Array<ArrayBuffer> } => {
      let source = ctx.createMediaStreamSource(stream)
      let 分析器 = ctx.createAnalyser()
      // 增大 fftSize 以捕获更长的时域窗口（2048 / 48000 ≈ 42.7ms），减少遗漏
      分析器.fftSize = 2048
      // 降低平滑系数让变化更灵敏
      分析器.smoothingTimeConstant = 0.3
      source.connect(分析器)
      // 使用 Float32Array 以获得更高精度的时域数据（范围 -1.0 ~ 1.0）
      return { 分析器, 数据: new Float32Array(分析器.fftSize) }
    }

    // 尝试分离轨道（如果有的话）
    let audioTracks = 媒体流.getAudioTracks()

    let 桌面轨道: MediaStreamTrack | undefined
    let 麦克风轨道: MediaStreamTrack | undefined

    // 1. 尝试通过标签识别
    桌面轨道 = audioTracks.find(
      (t) => t.label.toLowerCase().includes('system') || t.label.toLowerCase().includes('desktop'),
    )
    麦克风轨道 = audioTracks.find(
      (t) =>
        t.label.toLowerCase().includes('mic') ||
        t.label.toLowerCase().includes('audio input') ||
        (!t.label.toLowerCase().includes('system') && !t.label.toLowerCase().includes('desktop')),
    )

    // 2. 如果通过标签没分出来，或者分重了，则根据顺序强制分配
    if (audioTracks.length >= 2) {
      if (桌面轨道 === undefined || 麦克风轨道 === undefined || 桌面轨道 === 麦克风轨道) {
        桌面轨道 = audioTracks[0]
        麦克风轨道 = audioTracks[1]
      }
    } else if (audioTracks.length === 1) {
      // 只有一个轨道时，尝试判断它是哪种。如果没有明确标签，优先认为是麦克风（因为录制者通常最在乎麦克风）
      let 是桌面 = 桌面轨道 !== undefined
      if (是桌面) {
        桌面轨道 = audioTracks[0]
        麦克风轨道 = undefined
      } else {
        麦克风轨道 = audioTracks[0]
        桌面轨道 = undefined
      }
    }

    let 桌面分析 = 桌面轨道 !== undefined ? 创建分析器(new MediaStream([桌面轨道])) : null
    let 麦克风分析 = 麦克风轨道 !== undefined ? 创建分析器(new MediaStream([麦克风轨道])) : null

    let 计算音量 = (分析: { 分析器: AnalyserNode; 数据: Float32Array<ArrayBuffer> } | null): number => {
      if (分析 === null) return 0

      // 使用 getFloatTimeDomainData 获取 -1.0 ~ 1.0 范围的原始波形
      分析.分析器.getFloatTimeDomainData(分析.数据)

      let sumSquares = 0.0
      for (let i = 0; i < 分析.数据.length; i++) {
        let sample = 分析.数据[i] ?? 0
        sumSquares += sample * sample
      }
      let rms = Math.sqrt(sumSquares / 分析.数据.length)
      return Math.min(1.0, rms * 6)
    }

    let 循环 = (): void => {
      if (this.音频上下文 === null) return

      // 确保 AudioContext 始终处于活跃状态
      if (this.音频上下文.state === 'suspended') {
        void this.音频上下文.resume()
      }

      let 桌面音量 = 计算音量(桌面分析)
      let 麦克风音量 = 计算音量(麦克风分析)

      // 累积峰值: 取当前帧和累积值之间的较大值
      // 这确保了即使两个 rAF 循环不同步，录制器读到的也是自上次被读取以来的峰值
      this.桌面累积峰值 = Math.max(this.桌面累积峰值, 桌面音量)
      this.麦克风累积峰值 = Math.max(this.麦克风累积峰值, 麦克风音量)

      this.混音器组件?.更新实时电平('桌面', 桌面音量)
      this.混音器组件?.更新实时电平('麦克风', 麦克风音量)

      // 当前总音量使用累积峰值，确保录制器不会读到 0
      this.当前总音量 = Math.max(this.桌面累积峰值, this.麦克风累积峰值)

      this.动画帧ID = requestAnimationFrame(循环)
    }

    this.动画帧ID = requestAnimationFrame(循环)
  }

  /**
   * 消费当前累积的峰值音量并重置
   * 录制器在每帧采样时应调用此方法，这样可以确保:
   * 1. 获取到自上次采样以来的最大音量值（不会遗漏）
   * 2. 重置累积值，为下一帧做准备
   */
  public 消费峰值音量(): number {
    let 峰值 = Math.max(this.桌面累积峰值, this.麦克风累积峰值)
    // 重置累积峰值
    this.桌面累积峰值 = 0
    this.麦克风累积峰值 = 0
    return 峰值
  }

  public 停止(): void {
    if (this.动画帧ID !== null) {
      cancelAnimationFrame(this.动画帧ID)
      this.动画帧ID = null
    }
    if (this.音频上下文 !== null) {
      void this.音频上下文.close()
      this.音频上下文 = null
    }
  }
}
