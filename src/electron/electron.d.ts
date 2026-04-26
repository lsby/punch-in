export {}

declare global {
  interface Window {
    electronAPI?: {
      获取文件路径: (文件: File) => string
      获取屏幕列表: () => Promise<{ id: string; name: string; thumbnail: string }[]>
    }
  }
}
