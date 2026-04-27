import { 视频混音器组件 } from './video-audio-mixer'

export class 视频音频分析器 {
  private 音频上下文: AudioContext | null = null
  private 混音器组件: 视频混音器组件 | null = null
  public 当前总音量 = 0

  public 设置混音器(混音器: 视频混音器组件 | null): void {
    this.混音器组件 = 混音器
  }

  public 启动(媒体流: MediaStream): void {
    if (this.音频上下文 !== null) {
      void this.音频上下文.close()
    }

    this.音频上下文 = new AudioContext()
    let ctx = this.音频上下文

    let 创建分析器 = (stream: MediaStream): { 分析器: AnalyserNode; 数据: Uint8Array<ArrayBuffer> } => {
      let source = ctx.createMediaStreamSource(stream)
      let 分析器 = ctx.createAnalyser()
      分析器.fftSize = 512
      source.connect(分析器)
      return { 分析器, 数据: new Uint8Array(分析器.frequencyBinCount) }
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

    let 计算音量 = (分析: { 分析器: AnalyserNode; 数据: Uint8Array<ArrayBuffer> } | null): number => {
      if (分析 === null) return 0
      分析.分析器.getByteTimeDomainData(分析.数据)
      let sumSquares = 0.0
      for (let i = 0; i < 分析.数据.length; i++) {
        let normalized = ((分析.数据[i] ?? 128) - 128) / 128
        sumSquares += normalized * normalized
      }
      let rms = Math.sqrt(sumSquares / 分析.数据.length)
      return Math.min(1.0, rms * 6)
    }

    let 循环 = (): void => {
      if (this.音频上下文 === null) return

      let 桌面音量 = 计算音量(桌面分析)
      let 麦克风音量 = 计算音量(麦克风分析)

      this.混音器组件?.更新实时电平('桌面', 桌面音量)
      this.混音器组件?.更新实时电平('麦克风', 麦克风音量)

      this.当前总音量 = Math.max(桌面音量, 麦克风音量)

      requestAnimationFrame(循环)
    }

    requestAnimationFrame(循环)
  }

  public 停止(): void {
    if (this.音频上下文 !== null) {
      void this.音频上下文.close()
      this.音频上下文 = null
    }
  }
}
