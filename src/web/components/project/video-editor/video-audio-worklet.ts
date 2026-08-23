declare let sampleRate: number
declare abstract class AudioWorkletProcessor {
  public readonly port: MessagePort
  public abstract process(输入: Float32Array[][], 输出: Float32Array[][]): boolean
}
declare function registerProcessor(名称: string, 处理器: typeof AudioWorkletProcessor): void

class 音量计处理器 extends AudioWorkletProcessor {
  private 平方和 = 0
  private 样本数 = 0
  private 每次报告样本数 = Math.max(1, Math.floor(sampleRate / 100))

  public override process(输入: Float32Array[][]): boolean {
    let 输入通道 = 输入[0] ?? []
    if (输入通道.length === 0) return true
    let 帧数 = 输入通道[0]?.length ?? 0
    for (let i = 0; i < 帧数; i++) {
      let 混合值 = 0
      for (let 通道 of 输入通道) 混合值 += 通道[i] ?? 0
      混合值 /= 输入通道.length
      this.平方和 += 混合值 * 混合值
      this.样本数++
      if (this.样本数 < this.每次报告样本数) continue
      this.port.postMessage(Math.min(1, Math.sqrt(this.平方和 / this.样本数) * 6))
      this.平方和 = 0
      this.样本数 = 0
    }
    return true
  }
}

class 噪音门处理器 extends AudioWorkletProcessor {
  private 门限 = 0.01
  private 包络 = 0
  private 当前增益 = 0
  private 是否打开 = false

  public constructor() {
    super()
    this.port.onmessage = (事件: MessageEvent<number>): void => {
      this.门限 = Math.max(0, Math.min(1, 事件.data))
    }
  }

  public override process(输入: Float32Array[][], 输出: Float32Array[][]): boolean {
    let 输入通道 = 输入[0] ?? []
    let 输出通道 = 输出[0] ?? []
    let 帧数 = 输出通道[0]?.length ?? 0
    for (let i = 0; i < 帧数; i++) {
      let 峰值 = 0
      for (let 输入数据 of 输入通道) 峰值 = Math.max(峰值, Math.abs(输入数据[i] ?? 0))
      this.包络 = Math.max(峰值, this.包络 * 0.9995)
      if (this.是否打开) {
        if (this.包络 < this.门限 * 0.65) this.是否打开 = false
      } else if (this.包络 >= this.门限) this.是否打开 = true
      let 目标增益 = this.是否打开 ? 1 : 0
      let 平滑系数 = this.是否打开 ? 0.02 : 0.001
      this.当前增益 += (目标增益 - this.当前增益) * 平滑系数
      for (let 通道索引 = 0; 通道索引 < 输出通道.length; 通道索引++) {
        let 输出数据 = 输出通道[通道索引]
        if (输出数据 === undefined) continue
        输出数据[i] = (输入通道[通道索引]?.[i] ?? 0) * this.当前增益
      }
    }
    return true
  }
}

registerProcessor('lsby-volume-meter', 音量计处理器)
registerProcessor('lsby-noise-gate', 噪音门处理器)
