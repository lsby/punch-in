export type 裁剪规则 = {
  id: string
  名称: string
  描述: string
  音量条件: { 符号: '>' | '<'; 值: number }
  持续时间条件: { 符号: '>' | '<'; 值: number }
  区域微调: { 类型: '外扩' | '内缩'; 值: number }
  行为: '保留' | '去除'
}
