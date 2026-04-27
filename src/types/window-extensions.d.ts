export {}

declare global {
  interface MediaStreamTrackProcessorInit {
    track: MediaStreamTrack
    maxBufferSize?: number
  }

  class MediaStreamTrackProcessor<T = any> {
    public readable: ReadableStream<T>
    public constructor(init: MediaStreamTrackProcessorInit)
  }

  interface Window {
    MediaStreamTrackProcessor: typeof MediaStreamTrackProcessor
  }
}
