import { 视频导出器 } from './video-exporter'
import { 视频片段 } from './video-preview'

export type 录制状态 = { 切片列表: 视频片段[]; 实时波形数据: number[] }

export type 录制回调集 = {
  获取当前时间: () => number
  即时计算音量: () => number
  同步时间轴: (波形数据: number[], 采样率: number, 当前时间: number) => void
  录制完成: (新切片列表: 视频片段[], 波形数据: number[], 结束时间: number) => void
}

export class 视频录制器 {
  private 录制器: MediaRecorder | null = null
  private 录制的数据块: Blob[] = []
  private 录制循环ID: number | null = null
  private 录制开始时间: number = 0
  private 导出器 = new 视频导出器()

  public 实时波形数据: number[] = []
  public 切片列表: 视频片段[] = []

  public 是否正在录制(): boolean {
    return this.录制器 !== null && this.录制器.state === 'recording'
  }

  public 停止(): void {
    if (this.录制器 !== null && this.录制器.state === 'recording') {
      this.录制器.stop()
    }
  }

  public 开始录制(媒体流: MediaStream, 回调: 录制回调集): void {
    this.录制的数据块 = []

    let 穿插起点时间 = 回调.获取当前时间()

    // 截断波形或用0填充
    let 保留的波形长度 = Math.floor(穿插起点时间 * 100)
    if (this.实时波形数据.length > 保留的波形长度) {
      this.实时波形数据 = this.实时波形数据.slice(0, 保留的波形长度)
    } else {
      while (this.实时波形数据.length < 保留的波形长度) {
        this.实时波形数据.push(0)
      }
    }

    this.录制器 = new MediaRecorder(媒体流, { mimeType: 'video/webm' })

    // WebCodecs 实时编码准备
    void this.导出器.开始录制(媒体流)

    let 记录波形循环 = (): void => {
      // 只要录制器存在就继续循环，不依赖 state 判断（避免因 state 尚未切换导致循环提前终止）
      if (this.录制器 === null) return

      if (this.录制器.state === 'recording') {
        if (this.录制开始时间 === 0) {
          this.录制开始时间 = performance.now()
        }
        let 本次录制经过时间 = (performance.now() - this.录制开始时间) / 1000
        let 当前绝对时间 = 穿插起点时间 + 本次录制经过时间

        // 直接从 AnalyserNode 拉取最新数据（pull 模式），不依赖其他 rAF 循环
        let val = 回调.即时计算音量()

        let 目标长度 = Math.floor(当前绝对时间 * 100)
        while (this.实时波形数据.length < 目标长度) {
          this.实时波形数据.push(val)
        }

        回调.同步时间轴(this.实时波形数据, 100, 当前绝对时间)
      }

      this.录制循环ID = requestAnimationFrame(记录波形循环)
    }

    this.录制器.ondataavailable = (e): void => {
      if (e.data.size > 0) this.录制的数据块.push(e.data)
    }

    this.录制器.onstop = async (): Promise<void> => {
      if (this.录制循环ID !== null) cancelAnimationFrame(this.录制循环ID)

      let 编码结果 = await this.导出器.停止录制()

      let blob = new Blob(this.录制的数据块, { type: 'video/webm' })
      let url = URL.createObjectURL(blob)

      let 录制结束时间 = this.实时波形数据.length / 100

      let 新片段: 视频片段 = { url: url, start: 穿插起点时间, duration: 录制结束时间 - 穿插起点时间 }
      if (编码结果.videoChunks !== undefined) 新片段.videoChunks = 编码结果.videoChunks
      if (编码结果.audioChunks !== undefined) 新片段.audioChunks = 编码结果.audioChunks
      if (编码结果.videoConfig !== undefined) 新片段.videoConfig = 编码结果.videoConfig
      if (编码结果.audioConfig !== undefined) 新片段.audioConfig = 编码结果.audioConfig

      let 新切片列表: 视频片段[] = []
      for (let 片段 of this.切片列表) {
        if (片段.start >= 穿插起点时间) {
          continue
        } else if (片段.start + 片段.duration > 穿插起点时间) {
          新切片列表.push({ ...片段, duration: 穿插起点时间 - 片段.start })
        } else {
          新切片列表.push(片段)
        }
      }
      新切片列表.push(新片段)
      this.切片列表 = 新切片列表

      回调.录制完成(this.切片列表, this.实时波形数据, 录制结束时间)
    }

    this.录制开始时间 = 0
    this.录制器.start(100)
    this.录制循环ID = requestAnimationFrame(记录波形循环)
  }

  public async 导出MP4(配置: any): Promise<void> {
    if (this.切片列表.length === 0) {
      alert('没有可以导出的片段')
      return
    }
    await this.导出器.导出MP4(this.切片列表, 配置)
  }
}
