import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'

type 发出事件类型 = { 播放状态变化: boolean; 进度变化: number }
type 监听事件类型 = {}

export class 视频预览组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-preview', this)
  }

  private 视频元素: HTMLVideoElement | null = null
  private 进度循环ID: number | null = null
  private 状态标签: HTMLDivElement | null = null
  private 中心图标容器: HTMLDivElement | null = null
  private 反馈动画定时器ID: any = null
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

    this.视频元素.ontimeupdate = (): void => {
      this.更新时间显示()
      // 保留原本的事件发射作为兜底，但主要平滑更新将由 requestAnimationFrame 处理
      if (this.视频元素 !== null && this.视频元素.paused) {
        this.派发事件('进度变化', this.视频元素.currentTime)
      }
    }

    this.视频元素.onplay = (): void => {
      this.开始进度循环()
    }

    this.视频元素.onplaying = (): void => {
      this.更新状态标签(true)
    }

    this.视频元素.onwaiting = (): void => {
      this.更新状态标签(true, '正在缓冲...')
    }

    this.视频元素.onseeking = (): void => {
      this.更新状态标签(this.视频元素 !== null && !this.视频元素.paused, '寻道中...')
    }

    this.视频元素.onseeked = (): void => {
      if (this.视频元素 !== null) {
        this.更新状态标签(!this.视频元素.paused)
      }
    }

    this.视频元素.onpause = (): void => {
      this.停止进度循环()
      this.更新状态标签(false)
    }

    this.视频元素.onended = (): void => {
      this.停止进度循环()
      this.更新状态标签(false)
    }
  }

  protected override async 当卸载时(): Promise<void> {
    this.停止进度循环()
    window.removeEventListener('keydown', this.键盘监听器)
    if (this.视频元素 !== null) {
      this.视频元素.pause()
      this.视频元素.src = ''
      this.视频元素.load()
    }
  }

  private 开始进度循环(): void {
    if (this.进度循环ID !== null) return
    let 循环 = (): void => {
      if (this.视频元素 !== null && !this.视频元素.paused) {
        this.派发事件('进度变化', this.视频元素.currentTime)
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

  public 设置视频源(url: string): void {
    void this.log.info('设置视频源:', url)
    if (this.视频元素 !== null) {
      this.视频元素.pause()
      this.视频元素.currentTime = 0
      this.视频元素.src = url
      this.视频元素.load()
      this.更新状态标签(false)
      this.派发事件('播放状态变化', false)
      this.派发事件('进度变化', 0)
    }
  }

  public 切换播放状态(): void {
    if (this.视频元素 === null) return
    if (this.视频元素.paused) {
      void this.视频元素.play()
      this.派发事件('播放状态变化', true)
      this.执行状态反馈(true)
    } else {
      this.视频元素.pause()
      this.派发事件('播放状态变化', false)
      this.执行状态反馈(false)
    }
  }

  private 更新状态标签(正在播放: boolean, 额外文本?: string): void {
    if (this.状态标签 === null) return
    let 文本 = 额外文本 ?? (正在播放 ? '正在播放' : '已暂停')
    let 颜色 = 正在播放 ? '#4caf50' : '#ff9800'

    // 如果是中间状态，使用蓝色
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

    // 清理之前的定时器
    if (this.反馈动画定时器ID !== null) {
      clearTimeout(this.反馈动画定时器ID)
      this.反馈动画定时器ID = null
    }

    // 设置图标
    let 图标 = 正在播放
      ? '<svg viewBox="0 0 24 24" width="40" height="40" fill="white"><path d="M8 5v14l11-7z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="40" height="40" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'

    this.中心图标容器.innerHTML = 图标

    // 动画效果
    this.中心图标容器.style.opacity = '1'
    this.中心图标容器.style.transform = 'translate(-50%, -50%) scale(1)'

    // 1秒后消失
    this.反馈动画定时器ID = setTimeout(() => {
      if (this.中心图标容器 !== null) {
        this.中心图标容器.style.opacity = '0'
        this.中心图标容器.style.transform = 'translate(-50%, -50%) scale(1.5)'
        // 动画结束后重置 scale，但不影响透明度渐变
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
    if (this.视频元素 !== null) {
      let 原本在播放 = !this.视频元素.paused
      this.视频元素.currentTime = 时间
      // 如果原本在播放，尝试维持播放状态，防止部分浏览器在 seek 后停住
      if (原本在播放) {
        void this.视频元素.play().catch(() => {})
      }
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
