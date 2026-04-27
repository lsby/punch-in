import * as Mp4Muxer from 'mp4-muxer'
import { 视频片段 } from './video-preview'

type VideoChunkList = NonNullable<视频片段['videoChunks']>
type AudioChunkList = NonNullable<视频片段['audioChunks']>
type VideoConfig = NonNullable<视频片段['videoConfig']> & { bitrate?: number; framerate?: number }
type AudioConfig = NonNullable<视频片段['audioConfig']> & { bitrate?: number }

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
        codec: 'avc1.4d002a', // H.264 Main Profile
        width: settings.width ?? 1920,
        height: settings.height ?? 1080,
        bitrate: 5_000_000,
        framerate: settings.frameRate ?? 30,
      }
      this.vEncoder = new VideoEncoder({
        output: (chunk, meta): void => {
          if (meta?.decoderConfig !== undefined && meta.decoderConfig.description !== undefined) {
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
        while (this.isRecordingChunks) {
          let 结果 = await reader.read()
          if (结果.done) break

          let value = 结果.value
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (this.isRecordingChunks) {
            frameCount++
            this.vEncoder?.encode(value, { keyFrame: frameCount % 60 === 0 })
          }
          value.close()
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
          if (meta?.decoderConfig !== undefined && meta.decoderConfig.description !== undefined) {
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

  public 停止录制(): {
    videoChunks?: VideoChunkList
    audioChunks?: AudioChunkList
    videoConfig?: VideoConfig
    audioConfig?: AudioConfig
  } {
    this.isRecordingChunks = false

    if (this.vEncoder !== null) {
      let vEnc = this.vEncoder
      this.vEncoder = null
      void vEnc.flush().finally(() => {
        try {
          vEnc.close()
        } catch (_e) {}
      })
    }

    if (this.aEncoder !== null) {
      let aEnc = this.aEncoder
      this.aEncoder = null
      void aEnc.flush().finally(() => {
        try {
          aEnc.close()
        } catch (_e) {}
      })
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

  public async 导出MP4(切片列表: 视频片段[]): Promise<void> {
    if (切片列表.length === 0) {
      throw new Error('没有可以导出的片段')
    }

    this.正在导出 = true

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      let videoConfig = 切片列表.find((s) => s.videoConfig !== undefined && s.videoConfig !== null)?.videoConfig
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      let audioConfig = 切片列表.find((s) => s.audioConfig !== undefined && s.audioConfig !== null)?.audioConfig

      if (videoConfig === undefined) throw new Error('未发现视频轨道配置')

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

      let globalVideoTime = 0
      let globalAudioTime = 0

      for (let segment of 切片列表) {
        if (segment.videoChunks !== undefined && segment.videoChunks.length > 0) {
          let firstVChunk = segment.videoChunks[0]
          let firstAChunk = segment.audioChunks?.[0]

          let startVTs = firstVChunk !== undefined ? firstVChunk.timestamp : 0
          let startATs = firstAChunk !== undefined ? firstAChunk.timestamp : 0

          for (let vc of segment.videoChunks) {
            let relativeTs = vc.timestamp - startVTs
            if (relativeTs < 0) continue
            if (relativeTs > segment.duration * 1_000_000) break

            let meta: any = undefined
            if (segment.videoConfig?.description !== undefined && vc.type === 'key') {
              meta = {
                decoderConfig: {
                  codec: segment.videoConfig.codec,
                  description: segment.videoConfig.description,
                  codedWidth: segment.videoConfig.width,
                  codedHeight: segment.videoConfig.height,
                  colorSpace: undefined,
                },
              }
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

          if (segment.audioChunks !== undefined && audioConfig !== undefined) {
            for (let ac of segment.audioChunks) {
              let relativeTs = ac.timestamp - startATs
              if (relativeTs < 0) continue
              if (relativeTs > segment.duration * 1_000_000) break

              let meta: any = undefined
              if (segment.audioConfig?.description !== undefined && ac.type === 'key') {
                meta = {
                  decoderConfig: {
                    codec: segment.audioConfig.codec,
                    description: segment.audioConfig.description,
                    sampleRate: segment.audioConfig.sampleRate,
                    numberOfChannels: segment.audioConfig.numberOfChannels,
                  },
                }
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

      muxer.finalize()
      let buffer = target.buffer
      let blob = new Blob([buffer], { type: 'video/mp4' })
      let url = URL.createObjectURL(blob)
      let a = document.createElement('a')
      a.href = url
      a.download = `录制_${new Date().getTime()}.mp4`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(String(e))
      throw e
    } finally {
      this.正在导出 = false
    }
  }
}
