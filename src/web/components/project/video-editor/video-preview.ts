import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'

type 发出事件类型 = { 播放状态变化: boolean; 进度变化: number }
type 监听事件类型 = {}

export class 视频预览组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-preview', this)
  }

  private 视频元素: HTMLVideoElement | null = null
  private 键盘监听器: (e: KeyboardEvent) => void = (e) => {
    if (e.code === 'Space') {
      e.preventDefault()
      this.切换播放状态()
    }
  }

  protected override async 当加载时(): Promise<void> {
    this.获得宿主样式().display = 'flex'
    this.获得宿主样式().flex = '1'
    this.获得宿主样式().minHeight = '0'
    this.获得宿主样式().width = '100%'

    let 容器 = 创建元素('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
        position: 'relative',
        border: '1px solid #333',
      },
    })

    this.视频元素 = 创建元素('video', {
      style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000', cursor: 'pointer' },
    })
    this.视频元素.onclick = (): void => {
      this.切换播放状态()
    }

    容器.append(this.视频元素)
    this.shadow.append(容器)

    // 键盘监听
    window.addEventListener('keydown', this.键盘监听器)

    this.视频元素.ontimeupdate = (): void => {
      this.更新时间显示()
      if (this.视频元素 !== null) {
        this.派发事件('进度变化', this.视频元素.currentTime)
      }
    }
  }

  protected override async 当卸载时(): Promise<void> {
    window.removeEventListener('keydown', this.键盘监听器)
    if (this.视频元素 !== null) {
      this.视频元素.pause()
      this.视频元素.src = ''
      this.视频元素.load()
    }
  }

  public 设置视频源(url: string): void {
    void this.log.info('设置视频源:', url)
    if (this.视频元素 !== null) {
      this.视频元素.pause()
      this.视频元素.currentTime = 0
      this.视频元素.src = url
      this.视频元素.load()
      this.派发事件('播放状态变化', false)
      this.派发事件('进度变化', 0)
    }
  }

  public 切换播放状态(): void {
    if (this.视频元素 === null) return
    if (this.视频元素.paused) {
      void this.视频元素.play()
      this.派发事件('播放状态变化', true)
    } else {
      this.视频元素.pause()
      this.派发事件('播放状态变化', false)
    }
  }

  public 跳转(时间: number): void {
    if (this.视频元素 !== null) {
      this.视频元素.currentTime = 时间
    }
  }

  private 更新时间显示(): void {
    // 播放窗已移除, 暂时不需要更新时间显示
  }

  private 格式化时间(秒数: number): string {
    let 分 = Math.floor(秒数 / 60)
    let 秒 = Math.floor(秒数 % 60)
    return `${分.toString().padStart(2, '0')}:${秒.toString().padStart(2, '0')}`
  }
}
