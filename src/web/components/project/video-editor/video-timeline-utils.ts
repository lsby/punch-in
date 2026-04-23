export function 格式化时间(秒: number): string {
  let 时 = Math.floor(秒 / 3600)
  let 分 = Math.floor((秒 % 3600) / 60)
  let 剩余秒 = Math.floor(秒 % 60)
  if (时 > 0) {
    return `${时.toString().padStart(2, '0')}:${分.toString().padStart(2, '0')}:${剩余秒.toString().padStart(2, '0')}`
  }
  return `${分.toString().padStart(2, '0')}:${剩余秒.toString().padStart(2, '0')}`
}
