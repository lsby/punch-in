import { 视频混音器组件 } from './video-audio-mixer'

type 分析数据 = { 分析器: AnalyserNode; 数据: Float32Array<ArrayBuffer> }

export class 视频音频分析器 {
  private 音频上下文: AudioContext | null = null
  private 混音器组件: 视频混音器组件 | null = null
  private 动画帧ID: number | null = null

  // 持有 AnalyserNode 引用，供 即时计算音量() 直接拉取数据
  private 桌面分析: 分析数据 | null = null
  private 麦克风分析: 分析数据 | null = null

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

    let 创建分析器 = (stream: MediaStream): 分析数据 => {
      let source = ctx.createMediaStreamSource(stream)
      let 分析器 = ctx.createAnalyser()
      // 增大 fftSize 以捕获更长的时域窗口（2048 / 48000 ≈ 42.7ms），减少遗漏
      分析器.fftSize = 2048
      // 降低平滑系数让变化更灵敏
      分析器.smoothingTimeConstant = 0.3
      source.connect(分析器)
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

    this.桌面分析 = 桌面轨道 !== undefined ? 创建分析器(new MediaStream([桌面轨道])) : null
    this.麦克风分析 = 麦克风轨道 !== undefined ? 创建分析器(new MediaStream([麦克风轨道])) : null

    // rAF 循环仅用于更新混音器电平条显示（UI 反馈）
    let 循环 = (): void => {
      if (this.音频上下文 === null) return

      if (this.音频上下文.state === 'suspended') {
        void this.音频上下文.resume()
      }

      let 桌面音量 = this.计算单路音量(this.桌面分析)
      let 麦克风音量 = this.计算单路音量(this.麦克风分析)

      this.混音器组件?.更新实时电平('桌面', 桌面音量)
      this.混音器组件?.更新实时电平('麦克风', 麦克风音量)

      this.动画帧ID = requestAnimationFrame(循环)
    }

    this.动画帧ID = requestAnimationFrame(循环)
  }

  /**
   * 即时从 AnalyserNode 拉取最新时域数据并计算 RMS 音量。
   * 这是一个纯 pull 操作：直接读取 AnalyserNode 内部缓冲区，
   * 不依赖任何 rAF 循环的中间缓存，因此完全没有竞态条件。
   * 录制器应在自己的 rAF 回调中调用此方法。
   */
  public 即时计算音量(): number {
    if (this.音频上下文 !== null && this.音频上下文.state === 'suspended') {
      void this.音频上下文.resume()
    }
    let 桌面 = this.计算单路音量(this.桌面分析)
    let 麦克风 = this.计算单路音量(this.麦克风分析)
    return Math.max(桌面, 麦克风)
  }

  private 计算单路音量(分析: 分析数据 | null): number {
    if (分析 === null) return 0

    分析.分析器.getFloatTimeDomainData(分析.数据)

    let sumSquares = 0.0
    for (let i = 0; i < 分析.数据.length; i++) {
      let sample = 分析.数据[i] ?? 0
      sumSquares += sample * sample
    }
    let rms = Math.sqrt(sumSquares / 分析.数据.length)
    return Math.min(1.0, rms * 6)
  }

  public 停止(): void {
    if (this.动画帧ID !== null) {
      cancelAnimationFrame(this.动画帧ID)
      this.动画帧ID = null
    }
    this.桌面分析 = null
    this.麦克风分析 = null
    if (this.音频上下文 !== null) {
      void this.音频上下文.close()
      this.音频上下文 = null
    }
  }
}
