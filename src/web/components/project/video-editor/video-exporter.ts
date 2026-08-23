import {
  ALL_FORMATS,
  BlobSource,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  MediaStreamAudioTrackSource,
  MediaStreamVideoTrackSource,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny'
import { 视频片段 } from './video-editor-media'
import { 减去片段 } from './video-editor-utils'
import { 视频本地存储 } from './video-storage'

export type 导出进度 = { 进度: number; 阶段: string }
export type 导出配置 = { 文件名: string; 进度回调?: (进度: 导出进度) => void }
export type 时间范围 = { start: number; end: number }
export type 录制文件结果 = { id: string; 文件名: string; duration: number; 字节数: number; 警告: Error | null }

type 当前录制 = {
  id: string
  文件名: string
  输出: Output<Mp4OutputFormat, StreamTarget>
  视频源: MediaStreamVideoTrackSource
  音频源: MediaStreamAudioTrackSource | null
  错误: Error | null
  统计: { 编码字节数: number; 开始时间: number }
}

type 输入轨道信息 = {
  视频编码: 'avc' | null
  音频编码: 'aac' | null
  视频配置: VideoDecoderConfig | null
  音频配置: AudioDecoderConfig | null
}
type 视频尺寸 = { width: number; height: number }

export class 视频导出器 {
  private 当前录制: 当前录制 | null = null
  private 本地存储: 视频本地存储
  private 录制视频尺寸: 视频尺寸 | null = null

  public 正在导出 = false

  public constructor(本地存储: 视频本地存储) {
    this.本地存储 = 本地存储
  }

  public async 开始录制(stream: MediaStream, 时间轴起点: number, 现有片段列表: 视频片段[]): Promise<void> {
    if (this.当前录制 !== null) throw new Error('上一段录制尚未完成收尾')
    let 视频轨道 = stream.getVideoTracks()[0]
    if (视频轨道 === undefined) throw new Error('没有可录制的视频轨道')
    let 设置 = 视频轨道.getSettings()
    if (this.录制视频尺寸 === null) {
      this.录制视频尺寸 = (await this.获得现有视频尺寸(现有片段列表)) ?? {
        width: this.规范视频尺寸(设置.width ?? 1920),
        height: this.规范视频尺寸(设置.height ?? 1080),
      }
    }
    let 录制视频尺寸 = this.录制视频尺寸
    let 统计 = { 编码字节数: 0, 开始时间: performance.now() }
    let 视频质量 = new Quality({ bitrate: 10_000_000, bitrateMode: 'variable' })
    if (
      (await canEncodeVideo('avc', { width: 录制视频尺寸.width, height: 录制视频尺寸.height, quality: 视频质量 })) ===
      false
    ) {
      throw new Error('当前浏览器不支持将此画面编码为 H.264')
    }
    let 音频轨道 = stream.getAudioTracks()[0]
    let 音频质量 = new Quality({ bitrate: 128_000, bitrateMode: 'variable' })
    if (
      音频轨道 !== undefined &&
      (await canEncodeAudio('aac', {
        numberOfChannels: 音频轨道.getSettings().channelCount ?? 2,
        sampleRate: 音频轨道.getSettings().sampleRate ?? 48_000,
        quality: 音频质量,
      })) === false
    ) {
      throw new Error('当前浏览器不支持将混合音频编码为 AAC')
    }

    let 文件信息 = await this.本地存储.开始片段(时间轴起点)
    let 输出 = new Output({
      format: new Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 1 }),
      target: new StreamTarget(文件信息.可写流, { chunked: true, chunkSize: 1024 * 1024 }),
    })
    let 视频源 = new MediaStreamVideoTrackSource(
      视频轨道,
      {
        codec: 'avc',
        quality: 视频质量,
        keyFrameInterval: 0,
        transform: { width: 录制视频尺寸.width, height: 录制视频尺寸.height, fit: 'contain' },
        contentHint: 'detail',
        onEncodedPacket: (packet): void => {
          统计.编码字节数 += packet.byteLength
        },
      },
      { frameRate: Math.min(设置.frameRate ?? 30, 60) },
    )
    let 音频源 =
      音频轨道 === undefined
        ? null
        : new MediaStreamAudioTrackSource(音频轨道, {
            codec: 'aac',
            quality: 音频质量,
            onEncodedPacket: (packet): void => {
              统计.编码字节数 += packet.byteLength
            },
          })
    let 当前: 当前录制 = { id: 文件信息.id, 文件名: 文件信息.文件名, 输出, 视频源, 音频源, 错误: null, 统计 }
    this.当前录制 = 当前
    视频源.errorPromise.catch((错误: unknown): void => {
      当前.错误 = 错误 instanceof Error ? 错误 : new Error(String(错误))
    })
    音频源?.errorPromise.catch((错误: unknown): void => {
      当前.错误 = 错误 instanceof Error ? 错误 : new Error(String(错误))
    })
    输出.addVideoTrack(视频源)
    if (音频源 !== null) 输出.addAudioTrack(音频源)
    try {
      await 输出.start()
    } catch (错误) {
      this.当前录制 = null
      try {
        await 输出.cancel()
      } finally {
        await this.本地存储.放弃片段(文件信息.id, 文件信息.文件名)
      }
      throw 错误
    }
  }

  public async 停止录制(): Promise<录制文件结果> {
    let 当前 = this.当前录制
    if (当前 === null) throw new Error('当前没有正在录制的文件')
    this.当前录制 = null
    当前.视频源.close()
    当前.音频源?.close()
    let 收尾错误: Error | null = null
    try {
      await 当前.输出.finalize()
    } catch (错误) {
      收尾错误 = 错误 instanceof Error ? 错误 : new Error(String(错误))
    }
    try {
      let 警告 = 收尾错误 === null ? 当前.错误 : new Error(`录制收尾失败，但已自动恢复落盘内容：${收尾错误.message}`)
      return await this.读取录制文件结果(当前, 警告)
    } catch (恢复错误) {
      await this.本地存储.放弃片段(当前.id, 当前.文件名)
      if (收尾错误 === null) throw 恢复错误
      throw new Error(`录制收尾失败，落盘内容也无法恢复，已删除无效片段：${收尾错误.message}`)
    }
  }

  private async 读取录制文件结果(当前: 当前录制, 警告: Error | null): Promise<录制文件结果> {
    let 文件 = await this.本地存储.获得文件(this.本地存储.获得当前会话ID(), 当前.文件名)
    let 输入 = new Input({ formats: ALL_FORMATS, source: new BlobSource(文件) })
    try {
      let duration = await 输入.computeDuration()
      if (Number.isFinite(duration) === false || duration <= 0) throw new Error('录制文件没有有效时长')
      return { id: 当前.id, 文件名: 当前.文件名, duration, 字节数: 文件.size, 警告 }
    } finally {
      输入.dispose()
    }
  }

  public async 取消录制(): Promise<void> {
    let 当前 = this.当前录制
    if (当前 === null) return
    this.当前录制 = null
    当前.视频源.close()
    当前.音频源?.close()
    try {
      await 当前.输出.cancel()
    } finally {
      await this.本地存储.放弃片段(当前.id, 当前.文件名)
    }
  }

  public 获得当前错误(): Error | null {
    return this.当前录制?.错误 ?? null
  }

  public 获得当前每秒字节数(): number {
    let 当前 = this.当前录制
    if (当前 === null) return 10_128_000 / 8
    let 秒数 = (performance.now() - 当前.统计.开始时间) / 1000
    if (秒数 < 5 || 当前.统计.编码字节数 <= 0) return 10_128_000 / 8
    return 当前.统计.编码字节数 / 秒数
  }

  public async 导出MP4(切片列表: 视频片段[], 排除片段列表: 时间范围[], 配置: 导出配置): Promise<void> {
    if (切片列表.length === 0) throw new Error('没有可以导出的片段')
    if (this.正在导出) throw new Error('已有导出任务正在进行')
    this.正在导出 = true
    配置.进度回调?.({ 进度: 0.01, 阶段: '正在准备临时导出文件' })
    let 临时文件名 = `export-${crypto.randomUUID()}.mp4`
    let 输出: Output<Mp4OutputFormat, StreamTarget> | null = null
    try {
      let 轨道信息 = await this.读取轨道信息(切片列表)
      配置.进度回调?.({ 进度: 0.04, 阶段: '正在分析录制片段' })
      if (轨道信息.视频编码 === null) throw new Error('未发现有效的视频轨道')
      let 视频源 = new EncodedVideoPacketSource(轨道信息.视频编码)
      let 音频源 = 轨道信息.音频编码 === null ? null : new EncodedAudioPacketSource(轨道信息.音频编码)
      输出 = new Output({
        format: new Mp4OutputFormat({ fastStart: false }),
        target: new StreamTarget(this.本地存储.创建导出可写流(临时文件名), { chunked: true }),
      })
      输出.addVideoTrack(视频源)
      if (音频源 !== null) 输出.addAudioTrack(音频源)
      await 输出.start()

      let 输出时间 = 0
      let 已处理工作量 = 0
      let 总工作量 = this.计算导出工作量(切片列表, 排除片段列表)
      for (let 片段 of 切片列表) {
        let 文件 = await this.本地存储.获得文件(片段.会话ID, 片段.文件名)
        let 输入 = new Input({ formats: ALL_FORMATS, source: new BlobSource(文件) })
        try {
          let 视频轨道 = await 输入.getPrimaryVideoTrack()
          if (视频轨道 === null) continue
          let 音频轨道 = await 输入.getPrimaryAudioTrack()
          let 视频Sink = new EncodedPacketSink(视频轨道)
          let 音频Sink = 音频轨道 === null ? null : new EncodedPacketSink(音频轨道)
          let 视频配置 = await 视频轨道.getDecoderConfig()
          let 音频配置 = 音频轨道 === null ? null : await 音频轨道.getDecoderConfig()
          let 已发送视频配置 = false
          let 已发送音频配置 = false
          let 片段结束时间 = 片段.start + 片段.duration
          let 保留范围列表 = 减去片段([{ start: 片段.start, end: 片段结束时间 }], 排除片段列表)
          for (let 保留范围 of 保留范围列表) {
            let 本地起点 = Math.max(0, 保留范围.start - 片段.start)
            let 本地终点 = Math.min(片段.duration, 保留范围.end - 片段.start)
            let 当前工作量 = Math.max(0, 本地终点 - 本地起点)
            let 起始关键帧 = await this.获得下一个关键帧(视频Sink, 本地起点)
            if (起始关键帧 === null || 起始关键帧.timestamp >= 本地终点) {
              已处理工作量 += 当前工作量
              this.报告封装进度(配置, 已处理工作量, 总工作量)
              continue
            }
            let 实际起点 = 起始关键帧.timestamp
            let 本次输出时间 = 输出时间
            let [发送了视频配置, 发送了音频配置] = await Promise.all([
              this.写入视频范围(
                视频Sink,
                视频源,
                起始关键帧,
                实际起点,
                本地终点,
                本次输出时间,
                视频配置,
                已发送视频配置,
                (已处理范围): void => this.报告封装进度(配置, 已处理工作量 + 已处理范围, 总工作量),
              ),
              音频Sink === null || 音频源 === null
                ? Promise.resolve(false)
                : this.写入音频范围(音频Sink, 音频源, 实际起点, 本地终点, 本次输出时间, 音频配置, 已发送音频配置),
            ])
            if (发送了视频配置) 已发送视频配置 = true
            if (发送了音频配置) 已发送音频配置 = true
            输出时间 += 本地终点 - 实际起点
            已处理工作量 += 当前工作量
            this.报告封装进度(配置, 已处理工作量, 总工作量)
          }
        } finally {
          输入.dispose()
        }
      }
      if (输出时间 <= 0) {
        await 输出.cancel()
        throw new Error('剪辑规则应用后没有可导出的内容')
      }
      视频源.close()
      音频源?.close()
      配置.进度回调?.({ 进度: 0.96, 阶段: '正在完成 MP4 文件' })
      await 输出.finalize()
      配置.进度回调?.({ 进度: 0.98, 阶段: '正在选择保存位置' })
      await this.本地存储.保存并删除临时导出文件(临时文件名, `${配置.文件名}.mp4`)
      await this.本地存储.标记已导出()
      配置.进度回调?.({ 进度: 1, 阶段: '导出完成，文件已保存' })
    } catch (错误) {
      if (输出?.state === 'finalizing') 输出.state = 'started'
      if (输出 !== null && 输出.state !== 'canceled' && 输出.state !== 'finalized') {
        try {
          await 输出.cancel()
        } catch (取消错误) {
          console.error('取消失败的导出任务时发生错误', 取消错误)
        }
      }
      await this.本地存储.删除临时导出文件(临时文件名)
      throw 错误
    } finally {
      this.正在导出 = false
    }
  }

  private async 读取轨道信息(切片列表: 视频片段[]): Promise<输入轨道信息> {
    let 视频编码: 输入轨道信息['视频编码'] = null
    let 音频编码: 输入轨道信息['音频编码'] = null
    let 视频配置: VideoDecoderConfig | null = null
    let 音频配置: AudioDecoderConfig | null = null
    for (let 片段 of 切片列表) {
      let 输入 = new Input({
        formats: ALL_FORMATS,
        source: new BlobSource(await this.本地存储.获得文件(片段.会话ID, 片段.文件名)),
      })
      try {
        let 视频轨道 = await 输入.getPrimaryVideoTrack()
        let 音频轨道 = await 输入.getPrimaryAudioTrack()
        let 当前视频编码 = 视频轨道 === null ? null : await 视频轨道.getCodec()
        let 当前音频编码 = 音频轨道 === null ? null : await 音频轨道.getCodec()
        let 当前视频配置 = 视频轨道 === null ? null : await 视频轨道.getDecoderConfig()
        let 当前音频配置 = 音频轨道 === null ? null : await 音频轨道.getDecoderConfig()
        if (视频编码 === null && 当前视频编码 === 'avc') 视频编码 = 当前视频编码
        if (音频编码 === null && 当前音频编码 === 'aac') 音频编码 = 当前音频编码
        if (当前视频配置 !== null) {
          if (视频配置 === null) 视频配置 = 当前视频配置
          else if (this.视频配置兼容(视频配置, 当前视频配置) === false) {
            throw new Error('录制片段的视频尺寸或编码配置不一致，无法无损封装；请使用同一录制画布重新录制这些片段')
          }
        }
        if (当前音频配置 !== null) {
          if (音频配置 === null) 音频配置 = 当前音频配置
          else if (this.音频配置兼容(音频配置, 当前音频配置) === false) {
            throw new Error('录制片段的音频采样配置不一致，无法无损封装')
          }
        }
      } finally {
        输入.dispose()
      }
    }
    return { 视频编码, 音频编码, 视频配置, 音频配置 }
  }

  private async 获得下一个关键帧(sink: EncodedPacketSink, 起点: number): Promise<EncodedPacket | null> {
    let 关键帧 = await sink.getKeyPacket(起点, { verifyKeyPackets: true })
    if (关键帧 === null) 关键帧 = await sink.getFirstKeyPacket({ verifyKeyPackets: true })
    while (关键帧 !== null && 关键帧.timestamp < 起点 - 0.000_001) {
      关键帧 = await sink.getNextKeyPacket(关键帧, { verifyKeyPackets: true })
    }
    if (关键帧 !== null && 关键帧.timestamp - 起点 > 0.1) {
      throw new Error('当前片段使用旧版稀疏关键帧录制，裁剪点无法精确对齐；为避免静默丢失内容，已停止导出')
    }
    return 关键帧
  }

  private 规范视频尺寸(值: number): number {
    let 整数 = Math.max(2, Math.floor(值))
    return 整数 % 2 === 0 ? 整数 : 整数 - 1
  }

  private 视频配置兼容(左: VideoDecoderConfig, 右: VideoDecoderConfig): boolean {
    return (
      左.codec === 右.codec &&
      左.codedWidth === 右.codedWidth &&
      左.codedHeight === 右.codedHeight &&
      this.二进制配置相同(左.description, 右.description)
    )
  }

  private 音频配置兼容(左: AudioDecoderConfig, 右: AudioDecoderConfig): boolean {
    return (
      左.codec === 右.codec &&
      左.sampleRate === 右.sampleRate &&
      左.numberOfChannels === 右.numberOfChannels &&
      this.二进制配置相同(左.description, 右.description)
    )
  }

  private 二进制配置相同(左: AllowSharedBufferSource | undefined, 右: AllowSharedBufferSource | undefined): boolean {
    if (左 === undefined || 右 === undefined) return 左 === 右
    let 左字节 = this.转换字节视图(左)
    let 右字节 = this.转换字节视图(右)
    if (左字节.byteLength !== 右字节.byteLength) return false
    for (let i = 0; i < 左字节.byteLength; i++) if (左字节[i] !== 右字节[i]) return false
    return true
  }

  private 转换字节视图(数据: AllowSharedBufferSource): Uint8Array<ArrayBufferLike> {
    if (ArrayBuffer.isView(数据)) return new Uint8Array(数据.buffer, 数据.byteOffset, 数据.byteLength)
    return new Uint8Array(数据)
  }

  private async 获得现有视频尺寸(片段列表: 视频片段[]): Promise<视频尺寸 | null> {
    let 首个片段 = 片段列表[0]
    if (首个片段 === undefined) return null
    let 输入 = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(await this.本地存储.获得文件(首个片段.会话ID, 首个片段.文件名)),
    })
    try {
      let 视频轨道 = await 输入.getPrimaryVideoTrack()
      let 配置 = 视频轨道 === null ? null : await 视频轨道.getDecoderConfig()
      if (配置?.codedWidth === undefined || 配置.codedHeight === undefined) return null
      return { width: this.规范视频尺寸(配置.codedWidth), height: this.规范视频尺寸(配置.codedHeight) }
    } finally {
      输入.dispose()
    }
  }

  private async 写入视频范围(
    sink: EncodedPacketSink,
    source: EncodedVideoPacketSource,
    起始包: EncodedPacket,
    起点: number,
    终点: number,
    输出起点: number,
    配置: VideoDecoderConfig | null,
    已发送配置: boolean,
    报告进度: (已处理秒数: number) => void,
  ): Promise<boolean> {
    let 发送了配置 = false
    for await (let 包 of sink.packets(起始包)) {
      if (包.timestamp >= 终点) break
      if (包.timestamp + 包.duration <= 起点) continue
      let 新包 = new EncodedPacket(
        包.data,
        包.type,
        输出起点 + 包.timestamp - 起点,
        Math.min(包.duration, 终点 - 包.timestamp),
      )
      let meta = 已发送配置 || 发送了配置 || 配置 === null ? undefined : { decoderConfig: 配置 }
      await source.add(新包, meta)
      报告进度(Math.max(0, Math.min(终点 - 起点, 包.timestamp + 包.duration - 起点)))
      if (meta !== undefined) 发送了配置 = true
    }
    return 发送了配置
  }

  private async 写入音频范围(
    sink: EncodedPacketSink,
    source: EncodedAudioPacketSource,
    起点: number,
    终点: number,
    输出起点: number,
    配置: AudioDecoderConfig | null,
    已发送配置: boolean,
  ): Promise<boolean> {
    let 起始包 = await sink.getPacket(起点)
    if (起始包 === null) 起始包 = await sink.getFirstPacket()
    if (起始包 === null) return false
    let 发送了配置 = false
    for await (let 包 of sink.packets(起始包)) {
      if (包.timestamp >= 终点) break
      if (包.timestamp < 起点 || 包.timestamp + 包.duration > 终点) continue
      let 新包 = new EncodedPacket(包.data, 包.type, 输出起点 + 包.timestamp - 起点, 包.duration)
      let meta = 已发送配置 || 发送了配置 || 配置 === null ? undefined : { decoderConfig: 配置 }
      await source.add(新包, meta)
      if (meta !== undefined) 发送了配置 = true
    }
    return 发送了配置
  }

  private 计算导出工作量(切片列表: 视频片段[], 排除片段列表: 时间范围[]): number {
    let 总时长 = 0
    for (let 片段 of 切片列表) {
      let 片段结束时间 = 片段.start + 片段.duration
      let 保留范围列表 = 减去片段([{ start: 片段.start, end: 片段结束时间 }], 排除片段列表)
      for (let 保留范围 of 保留范围列表) 总时长 += Math.max(0, 保留范围.end - 保留范围.start)
    }
    return 总时长
  }

  private 报告封装进度(配置: 导出配置, 已处理工作量: number, 总工作量: number): void {
    let 比例 = 总工作量 <= 0 ? 0 : Math.max(0, Math.min(1, 已处理工作量 / 总工作量))
    配置.进度回调?.({ 进度: 0.05 + 比例 * 0.9, 阶段: '正在封装音视频' })
  }
}
