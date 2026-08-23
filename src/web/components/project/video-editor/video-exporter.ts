import * as Mp4Muxer from 'mp4-muxer'
import { 减去片段 } from './video-editor-utils'
import { 视频片段 } from './video-preview'

type VideoChunkList = NonNullable<视频片段['videoChunks']>
type AudioChunkList = NonNullable<视频片段['audioChunks']>
type VideoConfig = NonNullable<视频片段['videoConfig']> & { bitrate?: number; framerate?: number }
type AudioConfig = NonNullable<视频片段['audioConfig']> & { bitrate?: number }

export type 导出配置 = { 文件名: string }

export type 时间范围 = { start: number; end: number }

export class 视频导出器 {
  private 当前VideoChunks: VideoChunkList = []
  private 当前AudioChunks: AudioChunkList = []
  private 当前VideoConfig: VideoConfig | null = null
  private 当前AudioConfig: AudioConfig | null = null

  private vEncoder: VideoEncoder | null = null
  private aEncoder: AudioEncoder | null = null
  private isRecordingChunks: boolean = false

  public 正在导出: boolean = false

  public async 开始录制(stream: MediaStream): Promise<void> {
    this.当前VideoChunks = []
    this.当前AudioChunks = []
    this.当前VideoConfig = null
    this.当前AudioConfig = null
    this.isRecordingChunks = true

    let videoTrack = stream.getVideoTracks()[0]
    let audioTrack = stream.getAudioTracks()[0]

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (videoTrack !== undefined && window.VideoEncoder !== undefined) {
      let settings = videoTrack.getSettings()
      this.当前VideoConfig = {
        codec: 'avc1.4d0034', // H.264 Main Profile, Level 5.2 (支持 4K)
        width: settings.width ?? 1920,
        height: settings.height ?? 1080,
        bitrate: 10_000_000, // 4K 建议更高码率
        framerate: settings.frameRate ?? 30,
      }
      this.vEncoder = new VideoEncoder({
        output: (chunk, meta): void => {
          if (meta?.decoderConfig?.description !== undefined) {
            console.log('VideoEncoder 输出了 description:', meta.decoderConfig.description.byteLength)
            if (this.当前VideoConfig !== null) {
              this.当前VideoConfig.description = new Uint8Array(meta.decoderConfig.description as ArrayBuffer)
            }
          }
          let buf = new Uint8Array(chunk.byteLength)
          chunk.copyTo(buf)
          this.当前VideoChunks.push({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration ?? 0,
            data: buf,
          })
        },
        error: (e): void => console.error('VideoEncoder Error:', e),
      })
      this.vEncoder.configure(this.当前VideoConfig as VideoEncoderConfig)

      let processor = new window.MediaStreamTrackProcessor<VideoFrame>({ track: videoTrack.clone() })
      let reader = processor.readable.getReader()
      let frameCount = 0
      let 关键帧间隔 = Math.max(1, Math.round(this.当前VideoConfig.framerate ?? 30))
      let readLoop = async (): Promise<void> => {
        try {
          while (this.isRecordingChunks) {
            let 结果 = await reader.read()
            if (结果.done) break

            let value = 结果.value
            // 检查编码器状态，防止崩溃
            if (this.vEncoder !== null && this.vEncoder.state === 'configured') {
              frameCount++
              this.vEncoder.encode(value, { keyFrame: frameCount === 1 || frameCount % 关键帧间隔 === 0 })
            }
            value.close()
          }
        } catch (e) {
          console.error('视频读取循环错误:', e)
        }
      }
      void readLoop()
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (audioTrack !== undefined && window.AudioEncoder !== undefined) {
      let settings = audioTrack.getSettings()
      this.当前AudioConfig = {
        codec: 'mp4a.40.2', // AAC
        sampleRate: settings.sampleRate ?? 48000,
        numberOfChannels: settings.channelCount ?? 2,
        bitrate: 128000,
      }
      this.aEncoder = new AudioEncoder({
        output: (chunk, meta): void => {
          if (meta?.decoderConfig?.description !== undefined) {
            console.log('AudioEncoder 输出了 description:', meta.decoderConfig.description.byteLength)
            if (this.当前AudioConfig !== null) {
              this.当前AudioConfig.description = new Uint8Array(meta.decoderConfig.description as ArrayBuffer)
            }
          }
          let buf = new Uint8Array(chunk.byteLength)
          chunk.copyTo(buf)
          this.当前AudioChunks.push({
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration ?? 0,
            data: buf,
          })
        },
        error: (e): void => console.error('AudioEncoder Error:', e),
      })
      this.aEncoder.configure(this.当前AudioConfig as AudioEncoderConfig)

      let processor = new window.MediaStreamTrackProcessor<AudioData>({ track: audioTrack.clone() })
      let reader = processor.readable.getReader()
      let readLoop = async (): Promise<void> => {
        while (this.isRecordingChunks) {
          let 结果 = await reader.read()
          if (结果.done) break

          let value = 结果.value
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (this.isRecordingChunks) {
            this.aEncoder?.encode(value)
          }
          value.close()
        }
      }
      void readLoop()
    }
  }

  public async 停止录制(): Promise<{
    videoChunks?: VideoChunkList
    audioChunks?: AudioChunkList
    videoConfig?: VideoConfig
    audioConfig?: AudioConfig
  }> {
    this.isRecordingChunks = false

    if (this.vEncoder !== null) {
      let vEnc = this.vEncoder
      this.vEncoder = null
      try {
        await vEnc.flush()
        vEnc.close()
      } catch (_e) {}
    }

    if (this.aEncoder !== null) {
      let aEnc = this.aEncoder
      this.aEncoder = null
      try {
        await aEnc.flush()
        aEnc.close()
      } catch (_e) {}
    }

    let result: {
      videoChunks?: VideoChunkList
      audioChunks?: AudioChunkList
      videoConfig?: VideoConfig
      audioConfig?: AudioConfig
    } = {}

    if (this.当前VideoChunks.length > 0) result.videoChunks = this.当前VideoChunks
    if (this.当前AudioChunks.length > 0) result.audioChunks = this.当前AudioChunks
    if (this.当前VideoConfig !== null) result.videoConfig = this.当前VideoConfig
    if (this.当前AudioConfig !== null) result.audioConfig = this.当前AudioConfig

    return result
  }

  public async 导出MP4(切片列表: 视频片段[], 排除片段列表: 时间范围[], 配置: 导出配置): Promise<void> {
    if (切片列表.length === 0) {
      throw new Error('没有可以导出的片段')
    }

    this.正在导出 = true

    try {
      let videoConfig = 切片列表.find((s) => s.videoConfig?.description !== undefined)?.videoConfig
      let audioConfig = 切片列表.find((s) => s.audioConfig?.description !== undefined)?.audioConfig

      if (videoConfig === undefined) throw new Error('未发现有效的视频轨道配置')

      let target = new Mp4Muxer.ArrayBufferTarget()
      let options: Mp4Muxer.MuxerOptions<Mp4Muxer.ArrayBufferTarget> = {
        target: target,
        video: { codec: 'avc', width: videoConfig.width, height: videoConfig.height },
        fastStart: 'in-memory',
      }
      if (audioConfig !== undefined) {
        options.audio = {
          codec: 'aac',
          sampleRate: audioConfig.sampleRate,
          numberOfChannels: audioConfig.numberOfChannels,
        }
      }

      let muxer = new Mp4Muxer.Muxer(options)
      let videoTrackHasConfig = false
      let audioTrackHasConfig = false
      let 输出时间 = 0

      for (let segment of 切片列表) {
        let videoChunks = segment.videoChunks
        let 首个视频块 = videoChunks?.[0]
        if (videoChunks === undefined || 首个视频块 === undefined) continue

        let segment结束时间 = segment.start + segment.duration
        let 保留范围列表 = 减去片段([{ start: segment.start, end: segment结束时间 }], 排除片段列表)
        let startVTs = 首个视频块.timestamp
        let audioChunks = segment.audioChunks
        let startATs = audioChunks?.[0]?.timestamp
        let curVConfig = segment.videoConfig ?? videoConfig
        let curAConfig = segment.audioConfig ?? audioConfig

        for (let 保留范围 of 保留范围列表) {
          let 范围起点 = Math.max(segment.start, 保留范围.start)
          let 范围终点 = Math.min(segment结束时间, 保留范围.end)
          let 范围起点相对时间 = (范围起点 - segment.start) * 1_000_000
          let 范围终点相对时间 = (范围终点 - segment.start) * 1_000_000
          let 起始关键帧 = videoChunks.find((块) => {
            let 相对时间 = 块.timestamp - startVTs
            return 块.type === 'key' && 相对时间 >= 范围起点相对时间 && 相对时间 < 范围终点相对时间
          })
          if (起始关键帧 === undefined) continue

          let 实际起点相对时间 = 起始关键帧.timestamp - startVTs
          let 实际范围时长 = 范围终点相对时间 - 实际起点相对时间
          if (实际范围时长 <= 0) continue

          for (let vc of videoChunks) {
            let relativeTs = vc.timestamp - startVTs
            if (relativeTs < 实际起点相对时间 || relativeTs >= 范围终点相对时间) continue
            let meta: EncodedVideoChunkMetadata | undefined
            if (curVConfig.description !== undefined && (vc.type === 'key' || videoTrackHasConfig === false)) {
              meta = {
                decoderConfig: {
                  codec: curVConfig.codec,
                  description: curVConfig.description,
                  codedWidth: curVConfig.width,
                  codedHeight: curVConfig.height,
                },
              }
              videoTrackHasConfig = true
            }
            muxer.addVideoChunk(
              new EncodedVideoChunk({
                type: vc.type,
                timestamp: 输出时间 + relativeTs - 实际起点相对时间,
                duration: Math.min(vc.duration, 范围终点相对时间 - relativeTs),
                data: vc.data,
              }),
              meta,
            )
          }

          if (audioChunks !== undefined && startATs !== undefined && curAConfig !== undefined) {
            for (let ac of audioChunks) {
              let relativeTs = ac.timestamp - startATs
              if (relativeTs < 实际起点相对时间 || relativeTs >= 范围终点相对时间) continue
              let meta: EncodedAudioChunkMetadata | undefined
              if (curAConfig.description !== undefined && (ac.type === 'key' || audioTrackHasConfig === false)) {
                meta = {
                  decoderConfig: {
                    codec: curAConfig.codec,
                    description: curAConfig.description,
                    sampleRate: curAConfig.sampleRate,
                    numberOfChannels: curAConfig.numberOfChannels,
                  },
                }
                audioTrackHasConfig = true
              }
              muxer.addAudioChunk(
                new EncodedAudioChunk({
                  type: ac.type,
                  timestamp: 输出时间 + relativeTs - 实际起点相对时间,
                  duration: Math.min(ac.duration, 范围终点相对时间 - relativeTs),
                  data: ac.data,
                }),
                meta,
              )
            }
          }

          输出时间 += 实际范围时长
        }
      }

      if (输出时间 === 0) throw new Error('剪辑规则应用后没有可导出的内容')

      muxer.finalize()
      let blob = new Blob([target.buffer], { type: 'video/mp4' })
      let url = URL.createObjectURL(blob)
      let a = document.createElement('a')
      a.href = url
      a.download = `${配置.文件名}.mp4`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('导出过程发生错误:', e)
      throw e
    } finally {
      this.正在导出 = false
    }
  }
}
