import * as Mp4Muxer from 'mp4-muxer'
import { 视频片段 } from './video-preview'

type VideoChunkList = NonNullable<视频片段['videoChunks']>
type AudioChunkList = NonNullable<视频片段['audioChunks']>
type VideoConfig = NonNullable<视频片段['videoConfig']> & { bitrate?: number; framerate?: number }
type AudioConfig = NonNullable<视频片段['audioConfig']> & { bitrate?: number }

export type 导出配置 = {
  文件名: string
  视频宽度: number
  视频高度: number
  视频码率: number // bps
  视频帧率: number
  硬件加速: HardwareAcceleration
  导出模式: '快速' | '兼容'
}

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
      let readLoop = async (): Promise<void> => {
        try {
          while (this.isRecordingChunks) {
            let 结果 = await reader.read()
            if (结果.done) break

            let value = 结果.value
            // 检查编码器状态，防止崩溃
            if (this.vEncoder !== null && this.vEncoder.state === 'configured') {
              frameCount++
              this.vEncoder.encode(value, { keyFrame: frameCount === 1 || frameCount % 60 === 0 })
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

  public async 导出MP4(切片列表: 视频片段[], 配置: 导出配置): Promise<void> {
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
        video: {
          codec: 'avc',
          width: 配置.导出模式 === '快速' ? videoConfig.width : 配置.视频宽度,
          height: 配置.导出模式 === '快速' ? videoConfig.height : 配置.视频高度,
        },
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
      let globalVideoTime = 0
      let globalAudioTime = 0

      // ── 模式一：快速导出 (直接封装) ──
      if (配置.导出模式 === '快速') {
        let videoTrackHasConfig = false
        let audioTrackHasConfig = false

        for (let segment of 切片列表) {
          if (segment.videoChunks !== undefined && segment.videoChunks.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            let startVTs = segment.videoChunks[0]!.timestamp
            for (let vc of segment.videoChunks) {
              let relativeTs = vc.timestamp - startVTs
              if (relativeTs < 0 || relativeTs > segment.duration * 1_000_000) continue

              let meta: any = undefined
              let curVConfig = segment.videoConfig ?? videoConfig
              if (curVConfig.description !== undefined && (vc.type === 'key' || !videoTrackHasConfig)) {
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
                  timestamp: globalVideoTime + relativeTs,
                  duration: vc.duration,
                  data: vc.data,
                }),
                meta,
              )
            }
            globalVideoTime += segment.duration * 1_000_000

            if (segment.audioChunks !== undefined && segment.audioChunks.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              let startATs = segment.audioChunks[0]!.timestamp
              for (let ac of segment.audioChunks) {
                let relativeTs = ac.timestamp - startATs
                if (relativeTs < 0 || relativeTs > segment.duration * 1_000_000) continue
                let meta: any = undefined
                let curAConfig = segment.audioConfig ?? audioConfig
                if (curAConfig?.description !== undefined && (ac.type === 'key' || !audioTrackHasConfig)) {
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
                    timestamp: globalAudioTime + relativeTs,
                    duration: ac.duration,
                    data: ac.data,
                  }),
                  meta,
                )
              }
              globalAudioTime += segment.duration * 1_000_000
            }
          }
        }
      }
      // ── 模式二：兼容模式 (重编码) ──
      else {
        console.log('开始兼容模式重编码...', 配置)
        let canvas = new OffscreenCanvas(配置.视频宽度, 配置.视频高度)
        let ctx = canvas.getContext('2d')
        if (ctx === null) throw new Error('无法创建 OffscreenCanvas 上下文')

        let vEncoder = new VideoEncoder({
          output: (chunk, meta): void => muxer.addVideoChunk(chunk, meta),
          error: (e): void => console.error('导出编码错误:', e),
        })
        vEncoder.configure({
          codec: 'avc1.4d0034',
          width: 配置.视频宽度,
          height: 配置.视频高度,
          bitrate: 配置.视频码率,
          framerate: 配置.视频帧率,
          hardwareAcceleration: 配置.硬件加速,
        })

        let frameCount = 0
        for (let segment of 切片列表) {
          if (segment.videoChunks !== undefined && segment.videoChunks.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            let startVTs = segment.videoChunks[0]!.timestamp
            let curVConfig = segment.videoConfig ?? videoConfig

            // 创建解码器
            let vDecoder = new VideoDecoder({
              output: (frame): void => {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
                let newFrame = new VideoFrame(canvas, {
                  timestamp: globalVideoTime + frame.timestamp - startVTs,
                  duration: frame.duration ?? 0,
                })
                frameCount++
                vEncoder.encode(newFrame, { keyFrame: frameCount % 60 === 0 })
                newFrame.close()
                frame.close()
              },
              error: (e): void => console.error('导出解码错误:', e),
            })
            vDecoder.configure({
              codec: curVConfig.codec,
              description: curVConfig.description,
              codedWidth: curVConfig.width,
              codedHeight: curVConfig.height,
            } as VideoDecoderConfig)

            for (let vc of segment.videoChunks) {
              vDecoder.decode(
                new EncodedVideoChunk({ type: vc.type, timestamp: vc.timestamp, duration: vc.duration, data: vc.data }),
              )
            }
            await vDecoder.flush()
            vDecoder.close()
            globalVideoTime += segment.duration * 1_000_000

            // 音频处理 (目前兼容模式暂不重编码音频，仅封装)
            if (segment.audioChunks !== undefined && segment.audioChunks.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              let startATs = segment.audioChunks[0]!.timestamp
              for (let ac of segment.audioChunks) {
                let relativeTs = ac.timestamp - startATs
                muxer.addAudioChunk(
                  new EncodedAudioChunk({
                    type: ac.type,
                    timestamp: globalAudioTime + relativeTs,
                    duration: ac.duration,
                    data: ac.data,
                  }),
                )
              }
              globalAudioTime += segment.duration * 1_000_000
            }
          }
        }
        await vEncoder.flush()
        vEncoder.close()
      }

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
