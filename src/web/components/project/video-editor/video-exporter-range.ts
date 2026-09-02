import { EncodedPacket, EncodedPacketSink } from 'mediabunny'
import { 视频片段 } from './video-editor-media'
import type { 时间范围 } from './video-exporter'

export type 可封装范围 = 时间范围 & { 起始视频包: EncodedPacket }

export async function 对齐并合并保留范围(
  片段: 视频片段,
  保留范围列表: 时间范围[],
  视频Sink: EncodedPacketSink,
  音频Sink: EncodedPacketSink | null,
): Promise<可封装范围[]> {
  let 结果: 可封装范围[] = []
  for (let 保留范围 of 保留范围列表) {
    let 期望起点 = Math.max(0, 保留范围.start - 片段.start)
    let 期望终点 = Math.min(片段.duration, 保留范围.end - 片段.start)
    if (期望终点 <= 期望起点) continue
    let 起始关键帧 = await 视频Sink.getKeyPacket(期望起点, { verifyKeyPackets: true })
    if (起始关键帧 === null) return await 获得整段可封装范围(片段.duration, 视频Sink, 音频Sink)
    let 实际起点 = 起始关键帧.timestamp
    let 实际终点 = 期望终点
    if (音频Sink !== null) {
      let 音频起始包 = await 音频Sink.getPacket(实际起点)
      if (音频起始包 !== null && 音频起始包.timestamp + 音频起始包.duration > 实际起点 - 0.000_001) {
        实际起点 = Math.min(实际起点, 音频起始包.timestamp)
      }
      let 音频结束包 = await 音频Sink.getPacket(Math.max(期望起点, 期望终点 - 0.000_001))
      if (音频结束包 !== null && 音频结束包.timestamp < 期望终点) {
        实际终点 = Math.max(实际终点, 音频结束包.timestamp + 音频结束包.duration)
      }
    }
    let 最后范围 = 结果[结果.length - 1]
    if (最后范围 !== undefined && 实际起点 <= 最后范围.end + 0.000_001) {
      最后范围.end = Math.max(最后范围.end, 实际终点)
    } else {
      结果.push({ start: 实际起点, end: 实际终点, 起始视频包: 起始关键帧 })
    }
  }
  return 结果
}

async function 获得整段可封装范围(
  片段时长: number,
  视频Sink: EncodedPacketSink,
  音频Sink: EncodedPacketSink | null,
): Promise<可封装范围[]> {
  let 起始视频包 = await 视频Sink.getFirstPacket()
  if (起始视频包 === null) return []
  let 实际起点 = 起始视频包.timestamp
  let 实际终点 = 片段时长
  if (音频Sink !== null) {
    let 音频起始包 = await 音频Sink.getFirstPacket()
    let 音频结束包 = await 音频Sink.getPacket(Infinity)
    if (音频起始包 !== null) 实际起点 = Math.min(实际起点, 音频起始包.timestamp)
    if (音频结束包 !== null) 实际终点 = Math.max(实际终点, 音频结束包.timestamp + 音频结束包.duration)
  }
  return [{ start: 实际起点, end: 实际终点, 起始视频包 }]
}
