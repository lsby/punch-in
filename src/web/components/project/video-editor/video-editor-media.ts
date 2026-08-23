export type 视频片段 = {
  id: string
  会话ID: string
  文件名: string
  url: string
  start: number
  duration: number
  字节数: number
}

export type 持久视频片段 = Omit<视频片段, 'url'>
