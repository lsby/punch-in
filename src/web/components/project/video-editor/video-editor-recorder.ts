import { 视频片段 } from './video-editor-media'
import { 导出配置, 时间范围, 视频导出器 } from './video-exporter'
import { 视频本地存储 } from './video-storage'

export type 录制状态 = { 切片列表: 视频片段[]; 实时波形数据: number[] }
export type 录制阶段 = '空闲' | '启动中' | '录制中' | '收尾中'

export type 录制回调集 = {
  获取当前时间: () => number
  提取波形样本: () => number[]
  同步时间轴: (波形数据: number[], 采样率: number, 当前时间: number) => void
  录制完成: (新切片列表: 视频片段[], 波形数据: number[], 结束时间: number) => Promise<void>
  录制错误: (错误: Error) => void
}

export class 视频录制器 {
  private 录制循环ID: number | null = null
  private 穿插起点时间 = 0
  private 导出器: 视频导出器
  private 本地存储: 视频本地存储
  private 当前回调: 录制回调集 | null = null
  private 阶段: 录制阶段 = '空闲'
  private 收尾任务: Promise<void> | null = null
  private 录制开始性能时间 = 0

  public 实时波形数据: number[] = []
  public 切片列表: 视频片段[] = []

  public constructor(本地存储: 视频本地存储) {
    this.本地存储 = 本地存储
    this.导出器 = new 视频导出器(本地存储)
  }

  public 是否正在录制(): boolean {
    return this.阶段 === '录制中'
  }

  public 是否忙碌(): boolean {
    return this.阶段 !== '空闲' || this.导出器.正在导出
  }

  public 获得阶段(): 录制阶段 {
    return this.阶段
  }

  public 获得预计每秒字节数(): number {
    return this.导出器.获得当前每秒字节数()
  }

  public async 开始录制(媒体流: MediaStream, 回调: 录制回调集): Promise<void> {
    if (this.阶段 !== '空闲') throw new Error('录制器当前正忙')
    this.阶段 = '启动中'
    this.当前回调 = 回调
    this.穿插起点时间 = 回调.获取当前时间()
    回调.提取波形样本()

    try {
      await this.导出器.开始录制(媒体流, this.穿插起点时间, this.切片列表)
      回调.提取波形样本()
      let 保留的波形长度 = Math.floor(this.穿插起点时间 * 100)
      if (this.实时波形数据.length > 保留的波形长度) this.实时波形数据 = this.实时波形数据.slice(0, 保留的波形长度)
      else while (this.实时波形数据.length < 保留的波形长度) this.实时波形数据.push(0)
      this.录制开始性能时间 = performance.now()
      this.阶段 = '录制中'
      this.录制循环ID = window.setInterval((): void => this.记录波形(), 10)
    } catch (错误) {
      this.阶段 = '空闲'
      this.当前回调 = null
      throw 错误
    }
  }

  public async 停止(): Promise<void> {
    switch (this.阶段) {
      case '空闲':
      case '启动中':
        return
      case '收尾中': {
        let 任务 = this.收尾任务
        if (任务 !== null) await 任务
        return
      }
      case '录制中':
        break
    }
    this.阶段 = '收尾中'
    this.停止波形循环()
    let 回调 = this.当前回调
    let 任务 = this.执行停止(回调)
    this.收尾任务 = 任务
    try {
      await 任务
    } finally {
      if (this.收尾任务 === 任务) this.收尾任务 = null
    }
  }

  public async 取消(): Promise<void> {
    this.停止波形循环()
    await this.导出器.取消录制()
    this.阶段 = '空闲'
    this.当前回调 = null
  }

  public async 导出MP4(排除片段列表: 时间范围[], 配置: 导出配置): Promise<void> {
    await this.导出器.导出MP4(this.切片列表, 排除片段列表, 配置)
  }

  private 记录波形(): void {
    if (this.阶段 !== '录制中' || this.当前回调 === null) return
    let 编码错误 = this.导出器.获得当前错误()
    if (编码错误 !== null) {
      void this.停止().catch((错误: unknown): void => console.error('编码错误后的录制收尾失败', 错误))
      return
    }
    this.追加波形样本()
    let 当前绝对时间 = this.穿插起点时间 + (performance.now() - this.录制开始性能时间) / 1000
    this.校准波形长度(Math.floor(当前绝对时间 * 100))
    this.当前回调.同步时间轴(this.实时波形数据, 100, 当前绝对时间)
  }

  private 追加波形样本(): void {
    if (this.当前回调 === null) return
    let 样本 = this.当前回调.提取波形样本()
    if (样本.length > 0) this.实时波形数据.push(...样本)
  }

  private async 执行停止(回调: 录制回调集 | null): Promise<void> {
    try {
      let 编码结果 = await this.导出器.停止录制()
      this.追加波形样本()
      let 录制结束时间 = this.穿插起点时间 + 编码结果.duration
      let 目标波形长度 = Math.floor(录制结束时间 * 100)
      this.校准波形长度(目标波形长度)
      this.切片列表 = await this.本地存储.完成片段(
        编码结果.id,
        编码结果.文件名,
        this.穿插起点时间,
        编码结果.duration,
        this.实时波形数据,
      )
      if (回调 !== null) await 回调.录制完成(this.切片列表, this.实时波形数据, 录制结束时间)
      if (编码结果.警告 !== null) 回调?.录制错误(new Error(`编码提前结束，已保留可恢复内容：${编码结果.警告.message}`))
    } catch (错误) {
      let 规范错误 = 错误 instanceof Error ? 错误 : new Error(String(错误))
      回调?.录制错误(规范错误)
      throw 规范错误
    } finally {
      this.阶段 = '空闲'
      this.当前回调 = null
    }
  }

  private 停止波形循环(): void {
    if (this.录制循环ID === null) return
    clearInterval(this.录制循环ID)
    this.录制循环ID = null
  }

  private 校准波形长度(目标长度: number): void {
    let 最后音量 = this.实时波形数据[this.实时波形数据.length - 1] ?? 0
    while (this.实时波形数据.length < 目标长度) this.实时波形数据.push(最后音量)
    if (this.实时波形数据.length > 目标长度) this.实时波形数据 = this.实时波形数据.slice(0, 目标长度)
  }
}
