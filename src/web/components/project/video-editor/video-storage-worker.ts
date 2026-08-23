/// <reference lib="webworker" />

let 工作线程 = self as DedicatedWorkerGlobalScope
let 文件句柄: FileSystemSyncAccessHandle | null = null

type 工作请求 =
  | { 类型: '初始化'; 请求ID: number; 会话ID: string; 文件名: string }
  | { 类型: '写入'; 请求ID: number; 位置: number; 数据: ArrayBuffer }
  | { 类型: '关闭'; 请求ID: number }
  | { 类型: '中止'; 请求ID: number }

type 工作响应 = { 请求ID: number; 错误?: string }

async function 关闭文件(): Promise<void> {
  if (文件句柄 === null) return
  文件句柄.flush()
  文件句柄.close()
  文件句柄 = null
}

工作线程.onmessage = (事件: MessageEvent<工作请求>): void => {
  let 请求 = 事件.data
  void (async (): Promise<void> => {
    try {
      switch (请求.类型) {
        case '初始化': {
          let 根目录 = await navigator.storage.getDirectory()
          let 录制目录 = await 根目录.getDirectoryHandle('punch-in-recordings', { create: true })
          let 会话目录 = await 录制目录.getDirectoryHandle(请求.会话ID, { create: true })
          let 目标文件 = await 会话目录.getFileHandle(请求.文件名, { create: true })
          文件句柄 = await 目标文件.createSyncAccessHandle()
          文件句柄.truncate(0)
          文件句柄.flush()
          break
        }
        case '写入': {
          if (文件句柄 === null) throw new Error('录制文件尚未初始化')
          let 数据 = new Uint8Array(请求.数据)
          let 已写入 = 文件句柄.write(数据, { at: 请求.位置 })
          if (已写入 !== 数据.byteLength) throw new Error('录制文件未能完整写入')
          文件句柄.flush()
          break
        }
        case '关闭': {
          await 关闭文件()
          break
        }
        case '中止': {
          await 关闭文件()
          break
        }
      }
      工作线程.postMessage({ 请求ID: 请求.请求ID } satisfies 工作响应)
    } catch (错误) {
      工作线程.postMessage({ 请求ID: 请求.请求ID, 错误: String(错误) } satisfies 工作响应)
    }
  })()
}
