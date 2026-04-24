import { 裁剪规则 } from './video-editor-types'

export function 合并片段(
  目标: { start: number; end: number }[],
  要添加的: { start: number; end: number }[],
): { start: number; end: number }[] {
  let 所有片段 = [...目标, ...要添加的].sort((a, b) => a.start - b.start)
  if (所有片段.length === 0) return []
  let 元素0 = 所有片段[0]
  if (元素0 === undefined) throw new Error('意外的空值')
  let 结果 = [元素0]
  for (let i = 1; i < 所有片段.length; i++) {
    let 最后一个 = 结果[结果.length - 1]
    if (最后一个 === undefined) throw new Error('意外的空值')
    let 当前 = 所有片段[i]
    if (当前 === undefined) throw new Error('意外的空值')
    if (当前.start <= 最后一个.end) {
      最后一个.end = Math.max(最后一个.end, 当前.end)
    } else {
      结果.push(当前)
    }
  }
  return 结果
}

export function 减去片段(
  目标: { start: number; end: number }[],
  要减去的: { start: number; end: number }[],
): { start: number; end: number }[] {
  let 结果: { start: number; end: number }[] = []
  for (let 目标片段 of 目标) {
    let 当前拆分 = [目标片段]
    for (let 减片段 of 要减去的) {
      let 新拆分: { start: number; end: number }[] = []
      for (let 拆分片段 of 当前拆分) {
        if (减片段.end <= 拆分片段.start || 减片段.start >= 拆分片段.end) {
          新拆分.push(拆分片段)
        } else {
          if (拆分片段.start < 减片段.start) {
            新拆分.push({ start: 拆分片段.start, end: 减片段.start })
          }
          if (减片段.end < 拆分片段.end) {
            新拆分.push({ start: 减片段.end, end: 拆分片段.end })
          }
        }
      }
      当前拆分 = 新拆分
    }
    结果.push(...当前拆分)
  }
  return 结果
}

export function 计算排除片段(
  时长: number,
  峰值: number[],
  样本率: number,
  当前规则列表: 裁剪规则[],
): { start: number; end: number }[] {
  let 当前排除片段: { start: number; end: number }[] = []
  for (let 规则 of 当前规则列表) {
    let 匹配片段: { start: number; end: number }[] = []
    let 当前片段开始 = -1

    // 1. 匹配音量条件
    for (let i = 0; i < 峰值.length; i++) {
      let 当前峰值 = 峰值[i]
      if (当前峰值 === undefined) throw new Error('意外的空值')
      let 满足 = 规则.音量条件.符号 === '<' ? 当前峰值 < 规则.音量条件.值 : 当前峰值 > 规则.音量条件.值

      if (满足) {
        if (当前片段开始 === -1) 当前片段开始 = i
      } else {
        if (当前片段开始 !== -1) {
          匹配片段.push({ start: 当前片段开始 / 样本率, end: i / 样本率 })
          当前片段开始 = -1
        }
      }
    }
    if (当前片段开始 !== -1) {
      匹配片段.push({ start: 当前片段开始 / 样本率, end: 峰值.length / 样本率 })
    }

    // 2. 匹配持续时间条件
    匹配片段 = 匹配片段.filter((p) => {
      let 持续 = p.end - p.start
      return 规则.持续时间条件.符号 === '<' ? 持续 < 规则.持续时间条件.值 : 持续 > 规则.持续时间条件.值
    })

    // 3. 区域微调
    let 微调后片段: { start: number; end: number }[] = []
    let 最大结束时间 = 峰值.length / 样本率
    for (let p of 匹配片段) {
      let s = p.start
      let e = p.end
      if (规则.区域微调.类型 === '外扩') {
        if (s > 0) s -= 规则.区域微调.值
        if (e < 最大结束时间) e += 规则.区域微调.值
      } else {
        if (s > 0) s += 规则.区域微调.值
        if (e < 最大结束时间) e -= 规则.区域微调.值
      }
      s = Math.max(0, s)
      e = Math.min(时长, e)
      if (s < e) {
        微调后片段.push({ start: s, end: e })
      }
    }

    微调后片段 = 合并片段([], 微调后片段)

    // 对微调合并后的最终片段再次应用持续时间条件，过滤掉因为内缩导致变得极小、不符合用户预期的碎片
    微调后片段 = 微调后片段.filter((p) => {
      let 持续 = p.end - p.start
      // 强制过滤掉小于 0.1 秒的极短碎片，这种碎片在播放时会引起频繁 seek 卡顿，且无实际剪辑意义
      if (持续 < 0.1) return false
      return 规则.持续时间条件.符号 === '<' ? 持续 < 规则.持续时间条件.值 : 持续 >= 规则.持续时间条件.值
    })

    // 4. 应用行为
    if (规则.行为 === '去除') {
      当前排除片段 = 合并片段(当前排除片段, 微调后片段)
    } else {
      当前排除片段 = 减去片段(当前排除片段, 微调后片段)
    }
  }
  return 当前排除片段
}
