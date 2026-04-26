import { 格式化时间 } from './video-timeline-utils'

export type 渲染参数 = {
  当前缩放: number
  真实时长: number
  峰值数据: number[] | null
  滚动距离: number
  视口宽度: number
  像素比: number
}

export function 绘制波形(画布: HTMLCanvasElement, 参数: 渲染参数): void {
  let { 当前缩放, 峰值数据, 真实时长, 滚动距离, 像素比: dpr } = 参数
  let ctx = 画布.getContext('2d')
  if (ctx === null) return
  let width = 画布.width
  let height = 画布.height
  ctx.clearRect(0, 0, width, height)

  if (峰值数据 === null || 真实时长 <= 0) return

  // 渐变色波形
  let gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#818cf8')
  gradient.addColorStop(1, '#4f46e5')
  ctx.fillStyle = gradient

  // 中心线
  ctx.fillRect(0, height / 2, width, 1 * dpr)

  let 点数 = 峰值数据.length
  let 每秒点数 = 100
  let x步长 = 1 * dpr

  for (let px = 0; px < width; px += x步长) {
    let logicX = 滚动距离 + px / dpr
    let t_start = logicX / 当前缩放
    let t_end = (logicX + 1) / 当前缩放

    let idx_start = Math.floor(t_start * 每秒点数)
    let idx_end = Math.ceil(t_end * 每秒点数)
    if (idx_start >= 点数) continue

    idx_start = Math.max(0, Math.min(点数 - 1, idx_start))
    idx_end = Math.max(0, Math.min(点数, idx_end))

    let maxPeak = 0
    for (let i = idx_start; i < idx_end; i++) {
      let 峰值 = 峰值数据[i]
      if (峰值 !== undefined && 峰值 > maxPeak) maxPeak = 峰值
    }
    if (idx_start === idx_end && idx_start < 点数) {
      let 峰值 = 峰值数据[idx_start]
      if (峰值 !== undefined) maxPeak = 峰值
    }

    let h = maxPeak * height
    if (h > 0) {
      ctx.fillRect(px, (height - h) / 2, x步长, h)
    }
  }
}

export function 绘制刻度尺(画布: HTMLCanvasElement, 参数: 渲染参数): void {
  let { 当前缩放, 真实时长, 滚动距离, 视口宽度, 像素比: dpr } = 参数
  let ctx = 画布.getContext('2d')
  if (ctx === null) return
  let width = 画布.width
  let height = 画布.height
  ctx.clearRect(0, 0, width, height)

  if (真实时长 <= 0) return

  let 开始时间 = 滚动距离 / 当前缩放
  let 结束时间 = (滚动距离 + 视口宽度) / 当前缩放

  ctx.font = `500 ${10 * dpr}px Inter, sans-serif`
  ctx.textBaseline = 'top'

  let 理想间隔时间 = 100 / 当前缩放
  let 候选间隔 = [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600]
  let 实际间隔 = 候选间隔[候选间隔.length - 1]
  if (实际间隔 === undefined) throw new Error('意外的空值')
  for (let 间隔 of 候选间隔) {
    if (间隔 >= 理想间隔时间) {
      实际间隔 = 间隔
      break
    }
  }

  let 开始时间_对齐 = Math.floor(开始时间 / 实际间隔) * 实际间隔

  for (let t = 开始时间_对齐; t <= 结束时间; t += 实际间隔) {
    let logicX = t * 当前缩放 - 滚动距离
    let px = logicX * dpr

    // 画次级刻度
    for (let i = 1; i < 10; i++) {
      let subT = t + 实际间隔 * (i / 10)
      if (subT <= 结束时间) {
        let subLogicX = subT * 当前缩放 - 滚动距离
        ctx.fillStyle = 'rgba(156, 163, 175, 0.3)'
        ctx.fillRect(subLogicX * dpr, height - 4 * dpr, 1 * dpr, 4 * dpr)
      }
    }

    ctx.fillStyle = 'rgba(156, 163, 175, 0.7)'
    ctx.fillRect(px, height - 8 * dpr, 1 * dpr, 8 * dpr)
    let 文本 = 格式化时间(t)
    ctx.fillStyle = '#9ca3af'
    ctx.fillText(文本, px + 4 * dpr, 4 * dpr)
  }
}
