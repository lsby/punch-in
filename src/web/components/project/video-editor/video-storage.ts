import { StreamTargetChunk } from 'mediabunny'
import { z } from 'zod'
import { 持久视频片段, 视频片段 } from './video-editor-media'

let 持久视频片段Schema = z.object({
  id: z.string(),
  会话ID: z.string(),
  文件名: z.string(),
  start: z.number().finite().nonnegative(),
  duration: z.number().finite().nonnegative(),
  字节数: z.number().int().nonnegative(),
})
let 进行中片段Schema = z.object({
  id: z.string(),
  文件名: z.string(),
  start: z.number().finite().nonnegative(),
  开始时间: z.number(),
})
let 会话清单Schema = z.object({
  版本: z.literal(1),
  会话ID: z.string(),
  创建时间: z.number(),
  更新时间: z.number(),
  已导出: z.boolean(),
  片段列表: z.array(持久视频片段Schema),
  实时波形数据: z.array(z.number().finite().nonnegative()),
  进行中片段: 进行中片段Schema.optional(),
})

export type 录制会话清单 = z.infer<typeof 会话清单Schema>
export type 存储会话摘要 = {
  会话ID: string
  创建时间: number
  更新时间: number
  已导出: boolean
  字节数: number
  片段数: number
}
export type 存储统计 = {
  录制字节数: number
  来源已用字节数: number
  来源配额字节数: number
  来源可用字节数: number
  是否持久: boolean
}

type 工作响应 = { 请求ID: number; 错误?: string }
type 请求完成函数 = { resolve: () => void; reject: (错误: Error) => void }

function 是目录句柄(句柄: FileSystemHandle): 句柄 is FileSystemDirectoryHandle {
  return 句柄.kind === 'directory'
}

function 是文件句柄(句柄: FileSystemHandle): 句柄 is FileSystemFileHandle {
  return 句柄.kind === 'file'
}

class OPFS录制可写流 {
  private worker = new Worker(new URL('./video-storage-worker.ts', import.meta.url), { type: 'module' })
  private 下一个请求ID = 1
  private 请求列表 = new Map<number, 请求完成函数>()
  private 初始化完成: Promise<void>

  public constructor(会话ID: string, 文件名: string) {
    this.worker.onmessage = (事件: MessageEvent<工作响应>): void => {
      let 等待项 = this.请求列表.get(事件.data.请求ID)
      if (等待项 === undefined) return
      this.请求列表.delete(事件.data.请求ID)
      if (事件.data.错误 === undefined) 等待项.resolve()
      else 等待项.reject(new Error(事件.data.错误))
    }
    this.worker.onerror = (事件): void => {
      for (let 等待项 of this.请求列表.values()) 等待项.reject(new Error(事件.message))
      this.请求列表.clear()
    }
    this.初始化完成 = this.发送请求({ 类型: '初始化', 会话ID, 文件名 })
  }

  private 发送请求(
    请求:
      | { 类型: '初始化'; 会话ID: string; 文件名: string }
      | { 类型: '写入'; 位置: number; 数据: ArrayBuffer }
      | { 类型: '关闭' }
      | { 类型: '中止' },
  ): Promise<void> {
    let 请求ID = this.下一个请求ID++
    return new Promise<void>((resolve, reject) => {
      this.请求列表.set(请求ID, { resolve, reject })
      if (请求.类型 === '写入') this.worker.postMessage({ ...请求, 请求ID }, [请求.数据])
      else this.worker.postMessage({ ...请求, 请求ID })
    })
  }

  public 创建流(): WritableStream<StreamTargetChunk> {
    return new WritableStream<StreamTargetChunk>({
      write: async (数据块): Promise<void> => {
        await this.初始化完成
        let 数据 = 数据块.data.slice().buffer
        await this.发送请求({ 类型: '写入', 位置: 数据块.position, 数据 })
      },
      close: async (): Promise<void> => {
        await this.初始化完成
        await this.发送请求({ 类型: '关闭' })
        this.worker.terminate()
      },
      abort: async (): Promise<void> => {
        try {
          await this.初始化完成
          await this.发送请求({ 类型: '中止' })
        } finally {
          this.worker.terminate()
        }
      },
    })
  }
}

export class 视频本地存储 {
  private 根目录: FileSystemDirectoryHandle | null = null
  private 当前清单: 录制会话清单 | null = null
  private 对象URL = new Map<string, string>()

  public async 初始化(): Promise<{ 片段列表: 视频片段[]; 实时波形数据: number[] }> {
    this.根目录 = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle('punch-in-recordings', { create: true })
    await navigator.storage.persist()
    let 清单列表 = await this.读取全部清单()
    this.当前清单 = 清单列表.sort((a, b) => b.更新时间 - a.更新时间)[0] ?? this.创建空清单()
    await this.恢复进行中片段()
    await this.保存清单()
    return {
      片段列表: await this.构建运行时片段(this.当前清单.片段列表),
      实时波形数据: [...this.当前清单.实时波形数据],
    }
  }

  public 获得当前会话ID(): string {
    if (this.当前清单 === null) throw new Error('本地录制存储尚未初始化')
    return this.当前清单.会话ID
  }

  public async 开始片段(
    start: number,
  ): Promise<{ id: string; 文件名: string; 可写流: WritableStream<StreamTargetChunk> }> {
    if (this.当前清单 === null) throw new Error('本地录制存储尚未初始化')
    if (this.当前清单.进行中片段 !== undefined) throw new Error('上一次录制仍在等待恢复，请刷新页面后重试')
    let id = crypto.randomUUID()
    let 文件名 = `${id}.mp4`
    this.当前清单.进行中片段 = { id, 文件名, start, 开始时间: Date.now() }
    this.当前清单.更新时间 = Date.now()
    await this.保存清单()
    return { id, 文件名, 可写流: new OPFS录制可写流(this.当前清单.会话ID, 文件名).创建流() }
  }

  public async 完成片段(
    id: string,
    文件名: string,
    start: number,
    duration: number,
    波形数据: number[],
  ): Promise<视频片段[]> {
    if (this.当前清单 === null) throw new Error('本地录制存储尚未初始化')
    let 文件 = await this.获得文件(this.当前清单.会话ID, 文件名)
    let 新片段: 持久视频片段 = { id, 会话ID: this.当前清单.会话ID, 文件名, start, duration, 字节数: 文件.size }
    let 新片段列表 = this.截断片段(this.当前清单.片段列表, start)
    新片段列表.push(新片段)
    this.当前清单.片段列表 = 新片段列表
    this.当前清单.实时波形数据 = [...波形数据]
    this.当前清单.进行中片段 = undefined
    this.当前清单.已导出 = false
    this.当前清单.更新时间 = Date.now()
    await this.保存清单()
    return this.构建运行时片段(this.当前清单.片段列表)
  }

  public async 放弃片段(id: string, 文件名: string): Promise<void> {
    if (this.当前清单 === null || this.当前清单.进行中片段?.id !== id) return
    this.当前清单.进行中片段 = undefined
    this.当前清单.更新时间 = Date.now()
    let 会话目录 = await this.获得根目录().getDirectoryHandle(this.当前清单.会话ID)
    try {
      await 会话目录.removeEntry(文件名)
    } catch (_错误) {}
    await this.保存清单()
  }

  public async 保存时间轴(片段列表: 视频片段[], 波形数据: number[]): Promise<void> {
    if (this.当前清单 === null) throw new Error('本地录制存储尚未初始化')
    this.当前清单.片段列表 = 片段列表.map(({ url: _url, ...片段 }) => 片段)
    this.当前清单.实时波形数据 = [...波形数据]
    this.当前清单.已导出 = false
    this.当前清单.更新时间 = Date.now()
    await this.保存清单()
  }

  public async 标记已导出(): Promise<void> {
    if (this.当前清单 === null) return
    this.当前清单.已导出 = true
    this.当前清单.更新时间 = Date.now()
    await this.保存清单()
  }

  public async 清理未引用片段(保留片段: 视频片段[]): Promise<void> {
    if (this.当前清单 === null || this.当前清单.进行中片段 !== undefined) return
    let 保留文件 = new Set(保留片段.filter((片段) => 片段.会话ID === this.当前清单?.会话ID).map((片段) => 片段.文件名))
    let 会话目录 = await this.获得根目录().getDirectoryHandle(this.当前清单.会话ID)
    for await (let [名称, 句柄] of 会话目录.entries()) {
      if (是文件句柄(句柄) === false || 名称.endsWith('.mp4') === false || 名称.startsWith('export-')) continue
      if (保留文件.has(名称)) continue
      let 键 = `${this.当前清单.会话ID}/${名称}`
      let url = this.对象URL.get(键)
      if (url !== undefined) URL.revokeObjectURL(url)
      this.对象URL.delete(键)
      await 会话目录.removeEntry(名称)
    }
  }

  public async 获得文件(会话ID: string, 文件名: string): Promise<File> {
    let 根目录 = this.获得根目录()
    let 会话目录 = await 根目录.getDirectoryHandle(会话ID)
    return (await 会话目录.getFileHandle(文件名)).getFile()
  }

  public 创建导出可写流(文件名: string): WritableStream<StreamTargetChunk> {
    return new OPFS录制可写流(this.获得当前会话ID(), 文件名).创建流()
  }

  public async 下载并删除临时导出文件(文件名: string, 下载文件名: string): Promise<void> {
    let 文件 = await this.获得文件(this.获得当前会话ID(), 文件名)
    let url = URL.createObjectURL(文件)
    let 下载元素 = document.createElement('a')
    下载元素.href = url
    下载元素.download = 下载文件名
    下载元素.click()
    setTimeout((): void => {
      URL.revokeObjectURL(url)
      void (async (): Promise<void> => {
        try {
          let 会话目录 = await this.获得根目录().getDirectoryHandle(this.获得当前会话ID())
          await 会话目录.removeEntry(文件名)
        } catch (_错误) {}
      })()
    }, 60_000)
  }

  public async 获得统计(): Promise<存储统计> {
    let 估算 = await navigator.storage.estimate()
    let 是否持久 = await navigator.storage.persisted()
    let 录制字节数 = await this.计算录制文件大小(this.获得根目录())
    let 来源已用字节数 = 估算.usage ?? 0
    let 来源配额字节数 = 估算.quota ?? 0
    return {
      录制字节数,
      来源已用字节数,
      来源配额字节数,
      来源可用字节数: Math.max(0, 来源配额字节数 - 来源已用字节数),
      是否持久,
    }
  }

  public async 获得会话列表(): Promise<存储会话摘要[]> {
    let 清单列表 = await this.读取全部清单()
    let 结果: 存储会话摘要[] = []
    for (let 清单 of 清单列表) {
      let 会话目录 = await this.获得根目录().getDirectoryHandle(清单.会话ID)
      let 字节数 = await this.计算录制文件大小(会话目录)
      if (字节数 === 0 && 清单.片段列表.length === 0 && 清单.进行中片段 === undefined) continue
      结果.push({
        会话ID: 清单.会话ID,
        创建时间: 清单.创建时间,
        更新时间: 清单.更新时间,
        已导出: 清单.已导出,
        字节数,
        片段数: 清单.片段列表.length,
      })
    }
    return 结果.sort((a, b) => b.更新时间 - a.更新时间)
  }

  public async 删除会话(会话ID: string): Promise<boolean> {
    let 是否当前 = this.当前清单?.会话ID === 会话ID
    this.释放会话URL(会话ID)
    await this.获得根目录().removeEntry(会话ID, { recursive: true })
    if (是否当前) {
      this.当前清单 = this.创建空清单()
      await this.保存清单()
    }
    return 是否当前
  }

  public async 删除已导出会话(): Promise<boolean> {
    let 清单列表 = await this.读取全部清单()
    let 删除了当前 = false
    for (let 清单 of 清单列表) {
      if (清单.已导出 === false) continue
      if (await this.删除会话(清单.会话ID)) 删除了当前 = true
    }
    return 删除了当前
  }

  public async 删除全部会话(): Promise<void> {
    let 根目录 = this.获得根目录()
    for await (let [名称] of 根目录.entries()) await 根目录.removeEntry(名称, { recursive: true })
    this.释放全部URL()
    this.当前清单 = this.创建空清单()
    await this.保存清单()
  }

  public 释放全部URL(): void {
    for (let url of this.对象URL.values()) URL.revokeObjectURL(url)
    this.对象URL.clear()
  }

  private async 构建运行时片段(片段列表: 持久视频片段[]): Promise<视频片段[]> {
    let 结果: 视频片段[] = []
    for (let 片段 of 片段列表) {
      let 键 = `${片段.会话ID}/${片段.文件名}`
      let url = this.对象URL.get(键)
      if (url === undefined) {
        url = URL.createObjectURL(await this.获得文件(片段.会话ID, 片段.文件名))
        this.对象URL.set(键, url)
      }
      结果.push({ ...片段, url })
    }
    return 结果
  }

  private 截断片段(片段列表: 持久视频片段[], start: number): 持久视频片段[] {
    let 结果: 持久视频片段[] = []
    for (let 片段 of 片段列表) {
      if (片段.start >= start) continue
      if (片段.start + 片段.duration > start) 结果.push({ ...片段, duration: start - 片段.start })
      else 结果.push(片段)
    }
    return 结果
  }

  private 创建空清单(): 录制会话清单 {
    let 时间 = Date.now()
    return {
      版本: 1,
      会话ID: crypto.randomUUID(),
      创建时间: 时间,
      更新时间: 时间,
      已导出: false,
      片段列表: [],
      实时波形数据: [],
    }
  }

  private 获得根目录(): FileSystemDirectoryHandle {
    if (this.根目录 === null) throw new Error('本地录制存储尚未初始化')
    return this.根目录
  }

  private async 保存清单(): Promise<void> {
    if (this.当前清单 === null) return
    let 会话目录 = await this.获得根目录().getDirectoryHandle(this.当前清单.会话ID, { create: true })
    let 文件句柄 = await 会话目录.getFileHandle('manifest.json', { create: true })
    let 可写流 = await 文件句柄.createWritable()
    await 可写流.write(JSON.stringify(this.当前清单))
    await 可写流.close()
  }

  private async 读取全部清单(): Promise<录制会话清单[]> {
    let 结果: 录制会话清单[] = []
    for await (let [_名称, 句柄] of this.获得根目录().entries()) {
      if (是目录句柄(句柄) === false) continue
      try {
        let 文件 = await (await 句柄.getFileHandle('manifest.json')).getFile()
        结果.push(会话清单Schema.parse(JSON.parse(await 文件.text())))
      } catch (_错误) {}
    }
    return 结果
  }

  private async 恢复进行中片段(): Promise<void> {
    if (this.当前清单?.进行中片段 === undefined) return
    let 进行中 = this.当前清单.进行中片段
    try {
      let 文件 = await this.获得文件(this.当前清单.会话ID, 进行中.文件名)
      if (文件.size > 0) {
        let { ALL_FORMATS, BlobSource, Input } = await import('mediabunny')
        let 输入 = new Input({ formats: ALL_FORMATS, source: new BlobSource(文件) })
        let duration = await 输入.computeDuration()
        输入.dispose()
        if (Number.isFinite(duration) && duration > 0) {
          let 新片段: 持久视频片段 = {
            id: 进行中.id,
            会话ID: this.当前清单.会话ID,
            文件名: 进行中.文件名,
            start: 进行中.start,
            duration,
            字节数: 文件.size,
          }
          this.当前清单.片段列表 = [...this.截断片段(this.当前清单.片段列表, 进行中.start), 新片段]
        }
      }
    } catch (_错误) {}
    this.当前清单.进行中片段 = undefined
    this.当前清单.更新时间 = Date.now()
  }

  private async 计算录制文件大小(目录: FileSystemDirectoryHandle): Promise<number> {
    let 结果 = 0
    for await (let [名称, 句柄] of 目录.entries()) {
      if (是文件句柄(句柄) && 名称.endsWith('.mp4')) 结果 += (await 句柄.getFile()).size
      else if (是目录句柄(句柄)) 结果 += await this.计算录制文件大小(句柄)
    }
    return 结果
  }

  private 释放会话URL(会话ID: string): void {
    for (let [键, url] of this.对象URL.entries()) {
      if (键.startsWith(`${会话ID}/`) === false) continue
      URL.revokeObjectURL(url)
      this.对象URL.delete(键)
    }
  }
}
