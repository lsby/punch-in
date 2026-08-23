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
  private 终止错误: Error | null = null

  public constructor(会话ID: string, 文件名: string) {
    this.worker.onmessage = (事件: MessageEvent<工作响应>): void => {
      let 等待项 = this.请求列表.get(事件.data.请求ID)
      if (等待项 === undefined) return
      this.请求列表.delete(事件.data.请求ID)
      if (事件.data.错误 === undefined) 等待项.resolve()
      else {
        let 错误 = new Error(事件.data.错误)
        等待项.reject(错误)
        this.终止Worker(错误)
      }
    }
    this.worker.onerror = (事件): void => {
      this.终止Worker(new Error(事件.message))
    }
    this.worker.onmessageerror = (): void => this.终止Worker(new Error('录制存储工作线程返回了无法解析的数据'))
    this.初始化完成 = this.发送请求({ 类型: '初始化', 会话ID, 文件名 })
  }

  private 发送请求(
    请求:
      | { 类型: '初始化'; 会话ID: string; 文件名: string }
      | { 类型: '写入'; 位置: number; 数据: ArrayBuffer }
      | { 类型: '关闭' }
      | { 类型: '中止' },
  ): Promise<void> {
    if (this.终止错误 !== null) return Promise.reject(this.终止错误)
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
        try {
          await this.初始化完成
          await this.发送请求({ 类型: '关闭' })
        } finally {
          this.终止Worker(null)
        }
      },
      abort: async (): Promise<void> => {
        try {
          await this.初始化完成
          await this.发送请求({ 类型: '中止' })
        } finally {
          this.终止Worker(null)
        }
      },
    })
  }

  private 终止Worker(错误: Error | null): void {
    if (this.终止错误 !== null) return
    this.终止错误 = 错误 ?? new Error('录制存储工作线程已关闭')
    for (let 等待项 of this.请求列表.values()) 等待项.reject(this.终止错误)
    this.请求列表.clear()
    this.worker.terminate()
  }
}

export class 视频本地存储 {
  private 根目录: FileSystemDirectoryHandle | null = null
  private 当前清单: 录制会话清单 | null = null
  private 对象URL = new Map<string, string>()
  private 释放占用锁: (() => void) | null = null
  private 占用锁任务: Promise<void> | null = null

  public async 初始化(): Promise<{ 片段列表: 视频片段[]; 实时波形数据: number[]; 恢复提示: string | null }> {
    await this.获得占用锁()
    try {
      this.根目录 = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle('punch-in-recordings', { create: true })
      await navigator.storage.persist()
      let 清单列表 = await this.读取全部清单()
      this.当前清单 = 清单列表.sort((a, b) => b.更新时间 - a.更新时间)[0] ?? this.创建空清单()
      let 恢复提示 = await this.恢复进行中片段()
      await this.保存清单()
      return {
        片段列表: await this.构建运行时片段(this.当前清单.片段列表),
        实时波形数据: [...this.当前清单.实时波形数据],
        恢复提示,
      }
    } catch (错误) {
      await this.关闭()
      throw 错误
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

  public async 保存并删除临时导出文件(文件名: string, 下载文件名: string): Promise<void> {
    let 文件 = await this.获得文件(this.获得当前会话ID(), 文件名)
    if (window.showSaveFilePicker !== undefined) {
      let 文件句柄 = await window.showSaveFilePicker({
        suggestedName: 下载文件名,
        types: [{ description: 'MP4 视频', accept: { 'video/mp4': ['.mp4'] } }],
      })
      await 文件.stream().pipeTo(await 文件句柄.createWritable())
      await this.删除临时导出文件(文件名)
      return
    }
    let url = URL.createObjectURL(文件)
    let 下载元素 = document.createElement('a')
    下载元素.href = url
    下载元素.download = 下载文件名
    下载元素.click()
    setTimeout((): void => {
      URL.revokeObjectURL(url)
      void this.删除临时导出文件(文件名)
    }, 60_000)
  }

  public async 删除临时导出文件(文件名: string): Promise<void> {
    try {
      let 会话目录 = await this.获得根目录().getDirectoryHandle(this.获得当前会话ID())
      await 会话目录.removeEntry(文件名)
    } catch (_错误) {}
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

  public async 关闭(): Promise<void> {
    this.释放全部URL()
    let 释放 = this.释放占用锁
    let 任务 = this.占用锁任务
    this.释放占用锁 = null
    this.占用锁任务 = null
    释放?.()
    if (任务 !== null) await 任务
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

  private async 恢复进行中片段(): Promise<string | null> {
    if (this.当前清单?.进行中片段 === undefined) return null
    let 进行中 = this.当前清单.进行中片段
    let 是否恢复 = false
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
          let 保留波形长度 = Math.floor(进行中.start * 100)
          let 新波形数据 = this.当前清单.实时波形数据.slice(0, 保留波形长度)
          while (新波形数据.length < 保留波形长度) 新波形数据.push(0)
          try {
            新波形数据 = 新波形数据.concat(await this.生成文件波形(文件, duration, 100))
          } catch (错误) {
            console.error('恢复录制片段的波形失败，将使用静音波形', 错误)
            while (新波形数据.length < Math.floor((进行中.start + duration) * 100)) 新波形数据.push(0)
          }
          this.当前清单.实时波形数据 = 新波形数据.slice(0, Math.floor((进行中.start + duration) * 100))
          是否恢复 = true
        }
      }
    } catch (错误) {
      console.error('自动恢复上次录制失败', 错误)
    }
    if (是否恢复 === false) {
      let 会话目录 = await this.获得根目录().getDirectoryHandle(this.当前清单.会话ID)
      try {
        await 会话目录.removeEntry(进行中.文件名)
      } catch (_错误) {}
    }
    this.当前清单.进行中片段 = undefined
    this.当前清单.更新时间 = Date.now()
    return 是否恢复
      ? '检测到上次未完成收尾的录制，已自动恢复有效内容。'
      : '上次录制未完整保存且无法恢复，已删除无效片段。'
  }

  private async 获得占用锁(): Promise<void> {
    let 通知结果: ((是否获得: boolean) => void) | null = null
    let 获得结果 = new Promise<boolean>((resolve) => {
      通知结果 = resolve
    })
    let 等待释放 = new Promise<void>((resolve) => {
      this.释放占用锁 = resolve
    })
    this.占用锁任务 = navigator.locks.request<void>(
      'punch-in-recordings:editor',
      { mode: 'exclusive', ifAvailable: true },
      async (锁) => {
        let 通知 = 通知结果
        if (通知 === null) throw new Error('录制存储锁状态异常')
        if (锁 === null) {
          通知(false)
          return
        }
        通知(true)
        await 等待释放
      },
    )
    if ((await 获得结果) === true) return
    let 任务 = this.占用锁任务
    this.占用锁任务 = null
    this.释放占用锁 = null
    await 任务
    throw new Error('录制页面已在另一个标签页中打开，请关闭另一个页面后重试')
  }

  private async 计算录制文件大小(目录: FileSystemDirectoryHandle): Promise<number> {
    let 结果 = 0
    for await (let [名称, 句柄] of 目录.entries()) {
      if (是文件句柄(句柄) && 名称.endsWith('.mp4')) 结果 += (await 句柄.getFile()).size
      else if (是目录句柄(句柄)) 结果 += await this.计算录制文件大小(句柄)
    }
    return 结果
  }

  private async 生成文件波形(文件: File, duration: number, 每秒采样数: number): Promise<number[]> {
    let { ALL_FORMATS, AudioBufferSink, BlobSource, Input } = await import('mediabunny')
    let 输入 = new Input({ formats: ALL_FORMATS, source: new BlobSource(文件) })
    let 目标长度 = Math.floor(duration * 每秒采样数)
    let 结果 = new Array<number>(目标长度).fill(0)
    try {
      let 音频轨道 = await 输入.getPrimaryAudioTrack()
      if (音频轨道 === null) return 结果
      let sink = new AudioBufferSink(音频轨道)
      for await (let 包装音频 of sink.buffers(0, duration)) {
        let buffer = 包装音频.buffer
        for (let 声道 = 0; 声道 < buffer.numberOfChannels; 声道++) {
          let 数据 = buffer.getChannelData(声道)
          for (let i = 0; i < 数据.length; i++) {
            let 索引 = Math.floor((包装音频.timestamp + i / buffer.sampleRate) * 每秒采样数)
            if (索引 < 0 || 索引 >= 结果.length) continue
            let 音量 = Math.abs(数据[i] ?? 0)
            if (音量 > (结果[索引] ?? 0)) 结果[索引] = 音量
          }
        }
      }
      return 结果
    } finally {
      输入.dispose()
    }
  }
}
