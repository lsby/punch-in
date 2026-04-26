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

export function 生成规则展示信息(规则: 裁剪规则): { 标题: string; 描述: string; 标签列表: string[] } {
  let 标签列表: string[] = []

  // 1. 处理音量阈值
  if (规则.选择部分.音量阈值?.是否启用 === true) {
    let { 类型, 最小值, 最大值 } = 规则.选择部分.音量阈值
    let 展示单位 = 类型 === '相对峰值百分比' ? '%' : 'dB'
    let 展示最小值 = 类型 === '相对峰值百分比' ? (最小值 * 100).toFixed(0) : 最小值.toFixed(0)
    let 展示最大值 = 类型 === '相对峰值百分比' ? (最大值 * 100).toFixed(0) : 最大值.toFixed(0)
    标签列表.push(`音量: ${展示最小值}${展示单位} - ${展示最大值}${展示单位}`)
  }

  // 2. 处理持续时间
  if (规则.选择部分.持续时间?.是否启用 === true) {
    let { 符号, 值 } = 规则.选择部分.持续时间
    标签列表.push(`时长 ${符号} ${值}s`)
  }

  let 标题 = 标签列表.length > 0 ? 标签列表.join('，') : '全选片段'
  let 描述 = `${规则.行为 === '去除' ? '去除' : '保留'} (${规则.二次处理.区域微调.类型}${规则.二次处理.区域微调.类型 === '不处理' ? '' : 规则.二次处理.区域微调.值 + 's'} / 过滤${规则.二次处理.强制过滤时长}s)`

  return { 标题, 描述, 标签列表 }
}

export function 计算排除片段(
  时长: number,
  峰值: number[],
  样本率: number,
  当前规则列表: 裁剪规则[],
): { start: number; end: number }[] {
  let 当前排除片段: { start: number; end: number }[] = []
  for (let 规则 of 当前规则列表) {
    if (规则.已禁用 === true) continue
    let 匹配片段: { start: number; end: number }[] = []
    let 当前片段开始 = -1

    // 1. 匹配音量条件
    if (规则.选择部分.音量阈值?.是否启用 === true) {
      let { 类型, 最小值: 规则最小值, 最大值: 规则最大值 } = 规则.选择部分.音量阈值

      let 比较值列表 = 峰值
      if (类型 === '相对峰值百分比') {
        let 最大 = 0
        for (let p of 峰值) if (p > 最大) 最大 = p
        比较值列表 = 峰值.map((p) => p / (最大 === 0 || Number.isNaN(最大) ? 1 : 最大))
      } else {
        // 分贝强度: 100 + 20 * log10(p / max), 范围 0-100
        let 最大 = 0
        for (let p of 峰值) if (p > 最大) 最大 = p
        比较值列表 = 峰值.map((p) => {
          if (p <= 0 || 最大 <= 0) return 0
          let db = 100 + 20 * Math.log10(p / 最大)
          return Math.max(0, db)
        })
      }

      for (let i = 0; i < 比较值列表.length; i++) {
        let 当前值 = 比较值列表[i]
        if (当前值 === undefined) throw new Error('意外的空值')
        let 满足 = 当前值 >= 规则最小值 && 当前值 <= 规则最大值

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
    } else {
      匹配片段.push({ start: 0, end: 峰值.length / 样本率 })
    }

    // 2. 匹配持续时间条件
    if (规则.选择部分.持续时间?.是否启用 === true) {
      let 阈值 = 规则.选择部分.持续时间.值
      let 符号 = 规则.选择部分.持续时间.符号
      匹配片段 = 匹配片段.filter((p) => {
        let 持续 = p.end - p.start
        return 符号 === '<' ? 持续 < 阈值 : 持续 > 阈值
      })
    }

    // 3. 区域微调 (二次处理)
    let 微调后片段: { start: number; end: number }[] = []
    let 最大结束时间 = 峰值.length / 样本率
    for (let p of 匹配片段) {
      let s = p.start
      let e = p.end
      if (规则.二次处理.区域微调.类型 === '外扩') {
        if (s > 0) s -= 规则.二次处理.区域微调.值
        if (e < 最大结束时间) e += 规则.二次处理.区域微调.值
      } else if (规则.二次处理.区域微调.类型 === '内缩') {
        if (s > 0) s += 规则.二次处理.区域微调.值
        if (e < 最大结束时间) e -= 规则.二次处理.区域微调.值
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
      // 过滤掉极短碎片，这种碎片在播放时会引起频繁 seek 卡顿
      if (持续 < 规则.二次处理.强制过滤时长) return false

      if (规则.选择部分.持续时间?.是否启用 !== true) return true
      let 阈值 = 规则.选择部分.持续时间.值
      let 符号 = 规则.选择部分.持续时间.符号
      return 符号 === '<' ? 持续 < 阈值 : 持续 >= 阈值
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
