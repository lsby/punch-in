export type 裁剪规则 = {
  id: string
  名称?: string
  描述?: string
  已禁用?: boolean
  选择部分: {
    音量阈值?: { 是否启用: boolean; 类型: '相对峰值百分比' | '分贝强度'; 最小值: number; 最大值: number }
    持续时间?: { 是否启用: boolean; 符号: '>' | '<'; 值: number }
  }
  二次处理: { 区域微调: { 类型: '外扩' | '内缩'; 值: number }; 强制过滤时长: number }
  行为: '保留' | '去除'
}
