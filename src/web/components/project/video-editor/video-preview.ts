import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'

type 发出事件类型 = { 播放状态变化: boolean; 进度变化: number }
type 监听事件类型 = {}

export class 视频预览组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-preview', this)
  }

  private 播放器: HTMLVideoElement | null = null
  private 进度循环ID: number | null = null
  private 状态标签: HTMLDivElement | null = null
  private 中心图标容器: HTMLDivElement | null = null
  private 反馈动画定时器ID: any = null
  private 排除片段: { start: number; end: number }[] = []
  private 上一个跳越的片段: { start: number; end: number } | null = null

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

    // 创建播放器
    let video = 创建元素('video', {
      style: {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        backgroundColor: '#000',
        cursor: 'pointer',
        opacity: '1',
        zIndex: '1',
        pointerEvents: 'auto',
      },
    })

    video.onclick = (): void => {
      this.切换播放状态()
    }

    video.onplay = (): void => {
      this.开始进度循环()
    }

    video.onpause = (): void => {
      this.停止进度循环()
      this.更新状态标签(false)
    }

    video.onplaying = (): void => {
      this.更新状态标签(true)
    }

    video.onwaiting = (): void => {
      this.更新状态标签(true, '正在缓冲...')
    }

    video.onended = (): void => {
      this.停止进度循环()
      this.更新状态标签(false)
    }

    video.ontimeupdate = (): void => {
      if (video.paused) {
        this.派发事件('进度变化', video.currentTime)
      }
    }

    this.播放器 = video
    容器.append(video)

    // 状态标签 (右上角)
    this.状态标签 = 创建元素('div', {
      style: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        padding: '6px 12px',
        borderRadius: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#fff',
        fontSize: '12px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: '0.8',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: '10',
      },
    })
    this.更新状态标签(false)
    容器.append(this.状态标签)

    // 中心图标容器 (用于切换时的反馈)
    this.中心图标容器 = 创建元素('div', {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) scale(0.8)',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        zIndex: '11',
      },
    })
    容器.append(this.中心图标容器)

    this.shadow.append(容器)

    // 键盘监听
    window.addEventListener('keydown', this.键盘监听器)
  }

  protected override async 当卸载时(): Promise<void> {
    this.停止进度循环()
    window.removeEventListener('keydown', this.键盘监听器)
    if (this.播放器 !== null) {
      this.播放器.pause()
      this.播放器.src = ''
      this.播放器.load()
    }
  }

  private 开始进度循环(): void {
    if (this.进度循环ID !== null) return
    let 循环 = (): void => {
      let video = this.播放器
      if (video !== null && !video.paused) {
        let 当前时间 = video.currentTime
        let 命中的片段 = this.排除片段.find((s) => 当前时间 >= s.start && 当前时间 < s.end)

        if (命中的片段 !== undefined) {
          // 如果刚刚已经对这个片段发出过跳越指令，由于视频关键帧或浮点数问题可能还没完全爬出这个区间
          // 我们就不再重复发跳越指令，让播放器自然播放完这最后一点点误差时间
          if (this.上一个跳越的片段 !== 命中的片段 && !video.seeking) {
            this.上一个跳越的片段 = 命中的片段
            video.currentTime = 命中的片段.end
            this.派发事件('进度变化', video.currentTime)
          }
        } else {
          this.上一个跳越的片段 = null
          this.派发事件('进度变化', 当前时间)
        }
        this.进度循环ID = requestAnimationFrame(循环)
      } else {
        this.进度循环ID = null
      }
    }
    this.进度循环ID = requestAnimationFrame(循环)
  }

  private 停止进度循环(): void {
    if (this.进度循环ID !== null) {
      cancelAnimationFrame(this.进度循环ID)
      this.进度循环ID = null
    }
  }

  public 设置排除片段(片段: { start: number; end: number }[]): void {
    this.排除片段 = 片段
  }

  public 获取视频时长(): number {
    return this.播放器 !== null && !isNaN(this.播放器.duration) ? this.播放器.duration : 0
  }

  public 设置视频源(url: string): void {
    void this.log.info('设置视频源:', url)
    if (this.播放器 === null) return
    this.播放器.pause()
    this.播放器.currentTime = 0
    this.播放器.src = url
    this.播放器.load()
    this.播放器.muted = false
    this.更新状态标签(false)
    this.派发事件('播放状态变化', false)
    this.派发事件('进度变化', 0)
  }

  public 切换播放状态(): void {
    if (this.播放器 === null) return
    if (this.播放器.paused) {
      void this.播放器.play()
      this.派发事件('播放状态变化', true)
      this.执行状态反馈(true)
    } else {
      this.播放器.pause()
      this.派发事件('播放状态变化', false)
      this.执行状态反馈(false)
    }
  }

  private 更新状态标签(正在播放: boolean, 额外文本?: string): void {
    if (this.状态标签 === null) return
    let 文本 = 额外文本 ?? (正在播放 ? '正在播放' : '已暂停')
    let 颜色 = 正在播放 ? '#4caf50' : '#ff9800'

    if (额外文本 !== undefined) 颜色 = '#2196f3'

    this.状态标签.innerHTML = `
      <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${颜色}; box-shadow: 0 0 8px ${颜色};"></div>
      <span>${文本}</span>
    `
    this.状态标签.style.borderColor =
      额外文本 !== undefined
        ? 'rgba(33, 150, 243, 0.4)'
        : 正在播放
          ? 'rgba(76, 175, 80, 0.4)'
          : 'rgba(255, 152, 0, 0.4)'
  }

  private 执行状态反馈(正在播放: boolean): void {
    if (this.中心图标容器 === null) return

    if (this.反馈动画定时器ID !== null) {
      clearTimeout(this.反馈动画定时器ID)
      this.反馈动画定时器ID = null
    }

    let 图标 = 正在播放
      ? '<svg viewBox="0 0 24 24" width="40" height="40" fill="white"><path d="M8 5v14l11-7z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="40" height="40" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'

    this.中心图标容器.innerHTML = 图标

    this.中心图标容器.style.opacity = '1'
    this.中心图标容器.style.transform = 'translate(-50%, -50%) scale(1)'

    this.反馈动画定时器ID = setTimeout(() => {
      if (this.中心图标容器 !== null) {
        this.中心图标容器.style.opacity = '0'
        this.中心图标容器.style.transform = 'translate(-50%, -50%) scale(1.5)'
        this.反馈动画定时器ID = setTimeout(() => {
          if (this.中心图标容器 !== null && this.中心图标容器.style.opacity === '0') {
            this.中心图标容器.style.transform = 'translate(-50%, -50%) scale(0.8)'
          }
          this.反馈动画定时器ID = null
        }, 400)
      }
    }, 600)
  }

  public 跳转(时间: number): void {
    if (this.播放器 !== null) {
      let 原本在播放 = !this.播放器.paused
      this.播放器.currentTime = 时间
      if (原本在播放) {
        void this.播放器.play().catch(() => {})
      }
    }
  }
}
