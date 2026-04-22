import WaveSurfer from 'wavesurfer.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import { 组件基类 } from '../../../base/base'
import { API管理器 } from '../../../global/manager/api-manager'
import { 创建元素 } from '../../../global/tools/create-element'

type 发出事件类型 = { 进度跳转: number }
type 监听事件类型 = {}

export class 视频时间轴组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-timeline', this)
  }

  private 刻度尺容器: HTMLElement | null = null
  private 轨道容器: HTMLElement | null = null
  private 片段容器: HTMLElement | null = null
  private 波形容器: HTMLElement | null = null
  private ws: WaveSurfer | null = null
  private 当前缩放: number = 20
  private 是否正在拖拽进度: boolean = false
  private 是否正在滚动: boolean = false
  private 波形加载遮罩: HTMLElement | null = null

  private 预览视频: HTMLVideoElement | null = null
  private 预览窗: HTMLElement | null = null
  private 预览画布: HTMLCanvasElement | null = null
  private 预览时间标签: HTMLElement | null = null
  private 是否正在寻求预览: boolean = false

  protected override async 当加载时(): Promise<void> {
    this.获得宿主样式().display = 'block'
    this.获得宿主样式().width = '100%'

    let 容器 = 创建元素('div', {
      style: {
        width: '100%',
        height: '100%',
        backgroundColor: '#16191d',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333',
        borderRadius: '12px',
        fontFamily: "'Inter', sans-serif",
        userSelect: 'none',
        webkitUserSelect: 'none',
        position: 'relative',
      },
    })

    // 1. 刻度尺
    this.刻度尺容器 = 创建元素('div', {
      style: { width: '100%', height: '32px', backgroundColor: '#1a1e23', borderBottom: '1px solid #333' },
    })

    // 2. 轨道区域 (包含背景线和片段)
    this.轨道容器 = 创建元素('div', {
      style: {
        flex: '1',
        width: '100%',
        position: 'relative',
        overflowX: 'auto',
        overflowY: 'hidden',
        backgroundColor: '#0f1115',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '100% 40px',
      },
    })

    // 3. 片段 (Clip Block)
    this.片段容器 = 创建元素('div', {
      style: {
        position: 'absolute',
        top: '32px',
        left: '0',
        height: 'calc(100% - 32px)',
        minWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      },
    })

    this.波形容器 = 创建元素('div', {
      style: {
        flex: '1',
        width: '100%',
        backgroundColor: 'rgba(79, 70, 229, 0.02)',
        flexShrink: '0',
        position: 'relative',
      },
    })

    this.波形加载遮罩 = 创建元素('div', {
      style: {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(15, 17, 21, 0.9)',
        display: 'none',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '1000',
        backdropFilter: 'blur(8px)',
        color: '#818cf8',
        gap: '12px',
        fontSize: '14px',
        fontWeight: '500',
        borderRadius: '12px',
      },
    })

    let 加载动画 = 创建元素('div', {
      style: {
        width: '24px',
        height: '24px',
        border: '2px solid rgba(129, 140, 248, 0.1)',
        borderTopColor: '#818cf8',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      },
    })

    let 加载文字 = 创建元素('span', { textContent: '正在解析音频波形...' })
    this.波形加载遮罩.append(加载动画, 加载文字)

    let 动画样式 = 创建元素('style', {
      textContent: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `,
    })

    this.shadow.append(动画样式)

    // 预览窗
    this.预览窗 = 创建元素('div', {
      style: {
        position: 'absolute',
        bottom: 'calc(100% + 12px)',
        left: '0',
        display: 'none',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: '1000',
        transform: 'translateX(-50%)',
      },
    })

    let 预览框 = 创建元素('div', {
      style: {
        border: '2px solid #fff',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        backgroundColor: '#000',
        position: 'relative',
        width: '160px',
        height: '90px',
      },
    })

    this.预览画布 = 创建元素('canvas', {
      width: 160,
      height: 90,
      style: { width: '100%', height: '100%', display: 'block' },
    })

    this.预览时间标签 = 创建元素('div', {
      style: {
        position: 'absolute',
        bottom: '4px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 'bold',
      },
    })

    let 预览箭头 = 创建元素('div', {
      style: {
        width: '0',
        height: '0',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid #fff',
      },
    })

    预览框.append(this.预览画布, this.预览时间标签)
    this.预览窗.append(预览框, 预览箭头)

    this.片段容器.append(this.波形容器)
    this.轨道容器.append(this.刻度尺容器, this.片段容器)
    容器.append(this.轨道容器, this.波形加载遮罩, this.预览窗)
    this.shadow.append(容器)

    // 鼠标交互逻辑
    this.轨道容器.onmouseenter = (): void => {
      if (this.预览视频 !== null && this.预览窗 !== null) this.预览窗.style.display = 'flex'
    }

    this.轨道容器.onmouseleave = (): void => {
      if (this.预览窗 !== null) this.预览窗.style.display = 'none'
    }

    this.轨道容器.onmousemove = (e: MouseEvent): void => {
      if (
        this.预览窗 === null ||
        this.轨道容器 === null ||
        this.ws === null ||
        this.预览视频 === null ||
        this.是否正在拖拽进度 ||
        this.是否正在滚动
      )
        return
      this.预览窗.style.display = 'flex'

      let 容器矩形 = this.轨道容器.getBoundingClientRect()
      let 相对X = e.clientX - 容器矩形.left + this.轨道容器.scrollLeft
      let 时长 = this.ws.getDuration()
      let 时间 = (相对X / (时长 * this.当前缩放)) * 时长

      if (时间 < 0) 时间 = 0
      if (时间 > 时长) 时间 = 时长

      // 更新预览窗位置
      this.预览窗.style.left = `${e.clientX - 容器矩形.left}px`

      // 更新预览内容
      if (this.预览时间标签 !== null) this.预览时间标签.textContent = this.格式化时间(时间)

      if (!this.是否正在寻求预览) {
        this.是否正在寻求预览 = true
        this.预览视频.currentTime = 时间
      }
    }

    // 鼠标交互逻辑 (点击/拖动控制进度, 右键滚动)
    this.轨道容器.onmousedown = (e: MouseEvent): void => {
      if (this.ws === null || this.轨道容器 === null) return
      let 容器矩形 = this.轨道容器.getBoundingClientRect()
      let 时长 = this.ws.getDuration()
      if (时长 <= 0) return

      let 获取当前时间 = (e: MouseEvent): number => {
        if (this.轨道容器 === null) throw new Error('轨道容器不存在')
        let 相对X = e.clientX - 容器矩形.left + this.轨道容器.scrollLeft
        let 时间 = (相对X / (时长 * this.当前缩放)) * 时长
        return Math.max(0, Math.min(时长, 时间))
      }

      if (e.button === 0) {
        // 左键: 进度拖拽
        this.是否正在拖拽进度 = true
        if (this.预览窗 !== null) this.预览窗.style.display = 'none'

        let 执行更新 = (event: MouseEvent): void => {
          let 时间 = 获取当前时间(event)
          this.派发事件('进度跳转', 时间)
          if (this.ws !== null) this.ws.setTime(时间)
        }

        执行更新(e)

        let 拖拽请求ID: number | null = null
        let 处理移动 = (moveEvent: MouseEvent): void => {
          if (拖拽请求ID !== null) return
          拖拽请求ID = requestAnimationFrame(() => {
            拖拽请求ID = null
            if (this.是否正在拖拽进度) 执行更新(moveEvent)
          })
        }
        let 处理抬起 = (): void => {
          if (拖拽请求ID !== null) {
            cancelAnimationFrame(拖拽请求ID)
            拖拽请求ID = null
          }
          this.是否正在拖拽进度 = false
          window.removeEventListener('mousemove', 处理移动)
          window.removeEventListener('mouseup', 处理抬起)
        }
        window.addEventListener('mousemove', 处理移动)
        window.addEventListener('mouseup', 处理抬起)
      } else if (e.button === 2) {
        // 右键: 滚动
        this.是否正在滚动 = true
        if (this.预览窗 !== null) this.预览窗.style.display = 'none'
        let 起始X = e.clientX
        let 起始滚动 = this.轨道容器.scrollLeft

        let 处理移动 = (e: MouseEvent): void => {
          if (this.轨道容器 === null) return
          if (this.是否正在滚动) {
            let 偏移 = e.clientX - 起始X
            this.轨道容器.scrollLeft = 起始滚动 - 偏移
          }
        }
        let 处理抬起 = (): void => {
          this.是否正在滚动 = false
          window.removeEventListener('mousemove', 处理移动)
          window.removeEventListener('mouseup', 处理抬起)
        }
        window.addEventListener('mousemove', 处理移动)
        window.addEventListener('mouseup', 处理抬起)
      }
    }

    // 滚轮缩放
    this.轨道容器.onwheel = (e: WheelEvent): void => {
      if (this.ws === null || this.轨道容器 === null) return
      e.preventDefault()

      let 容器矩形 = this.轨道容器.getBoundingClientRect()
      let 相对X = e.clientX - 容器矩形.left
      let 时长 = this.ws.getDuration()
      if (时长 <= 0) return
      let 锚点时间 = ((相对X + this.轨道容器.scrollLeft) / (时长 * this.当前缩放)) * 时长

      let 增量 = e.deltaY > 0 ? 0.9 : 1.1
      let 新缩放 = Math.min(1000, Math.max(10, this.当前缩放 * 增量))
      this.执行缩放(新缩放, 锚点时间, 相对X)
    }

    this.轨道容器.oncontextmenu = (e: MouseEvent): void => {
      e.preventDefault()
    }

    // 初始化 WaveSurfer
    setTimeout(() => {
      this.初始化波形()
    }, 0)
  }

  protected override async 当卸载时(): Promise<void> {
    if (this.ws !== null) {
      this.ws.destroy()
      this.ws = null
    }
    if (this.预览视频 !== null) {
      this.预览视频.src = ''
      this.预览视频.load()
      this.预览视频 = null
    }
  }

  private 格式化时间(秒: number): string {
    let 分 = Math.floor(秒 / 60)
    let 剩余秒 = Math.floor(秒 % 60)
    return `${分.toString().padStart(2, '0')}:${剩余秒.toString().padStart(2, '0')}`
  }

  private 初始化波形(): void {
    if (this.波形容器 === null || this.刻度尺容器 === null) return

    if (this.ws !== null) {
      this.ws.destroy()
    }

    this.ws = WaveSurfer.create({
      container: this.波形容器,
      waveColor: '#4f46e5',
      progressColor: '#818cf8',
      cursorColor: '#ffffff',
      cursorWidth: 2,
      height: this.波形容器.offsetHeight,
      minPxPerSec: 20,
      fillParent: false,
      interact: false,
      autoScroll: true,
      plugins: [
        TimelinePlugin.create({
          container: this.刻度尺容器,
          height: 32,
          style: { color: '#aaa', fontSize: '10px' },
          secondaryLabelOpacity: 0.6,
        }),
      ],
    })
  }

  private 执行缩放(值: number, 锚点时间?: number, 锚点偏移?: number): void {
    if (this.ws === null || this.轨道容器 === null) return

    let 旧缩放 = this.当前缩放
    let 时长 = this.ws.getDuration()
    if (时长 <= 0) return

    // 如果没传锚点，默认用当前播放时间
    let 实际锚点时间 = 锚点时间 ?? this.ws.getCurrentTime()
    // 如果没传偏移，计算当前锚点时间在视口中的偏移
    let 实际锚点偏移 = 锚点偏移 ?? 实际锚点时间 * 旧缩放 - this.轨道容器.scrollLeft

    this.当前缩放 = 值
    this.ws.zoom(值)

    // 同步更新容器宽度
    let 总宽度 = 时长 * 值
    if (this.片段容器 !== null) {
      this.片段容器.style.width = `${总宽度}px`
    }
    if (this.刻度尺容器 !== null) {
      this.刻度尺容器.style.width = `${总宽度}px`
      this.刻度尺容器.style.minWidth = '100%'
    }

    // 缩放后，调整滚动位置，使当前播放位置保持在视口中的原相对位置
    this.轨道容器.scrollLeft = 实际锚点时间 * 值 - 实际锚点偏移
  }

  public async 设置资源(url: string, 文件名?: string, 真实路径?: string): Promise<void> {
    if (this.波形加载遮罩 !== null) {
      this.波形加载遮罩.style.display = 'flex'
    }
    if (this.轨道容器 !== null) {
      this.轨道容器.scrollLeft = 0
    }

    try {
      if (this.ws !== null) {
        this.ws.empty() // 立即清空旧波形
      }

      let 峰值: number[] | undefined = undefined
      if (真实路径 !== undefined) {
        try {
          let 结果 = await API管理器.请求postJson并处理错误('/api/project/get-video-peaks', {
            videoPath: 真实路径,
            samplesPerSecond: 100,
          })
          峰值 = 结果.peaks
        } catch (e) {
          console.error('获取峰值数据失败，将回退到默认加载方式:', e)
        }
      }

      if (this.ws !== null) {
        this.当前缩放 = 20
        await this.ws.load(url, 峰值 !== undefined ? [峰值] : undefined)
        this.ws.setTime(0)
        this.执行缩放(this.当前缩放)
      }
    } finally {
      if (this.波形加载遮罩 !== null) {
        this.波形加载遮罩.style.display = 'none'
      }
    }

    // 初始化预览视频
    if (this.预览视频 === null) {
      this.预览视频 = document.createElement('video')
      this.预览视频.muted = true
      this.预览视频.onseeked = (): void => {
        if (this.预览画布 !== null && this.预览视频 !== null) {
          let 上下文 = this.预览画布.getContext('2d')
          if (上下文 !== null) {
            上下文.drawImage(this.预览视频, 0, 0, 160, 90)
          }
        }
        this.是否正在寻求预览 = false
      }
    }
    this.预览视频.src = url

    // 清除预览画布并隐藏预览窗
    if (this.预览窗 !== null) {
      this.预览窗.style.display = 'none'
    }
    if (this.预览画布 !== null) {
      let 上下文 = this.预览画布.getContext('2d')
      if (上下文 !== null) {
        上下文.clearRect(0, 0, this.预览画布.width, this.预览画布.height)
      }
    }
  }

  public 同步进度(时间: number): void {
    if (this.是否正在拖拽进度) return // 拖拽时忽略外部同步，避免卡顿
    if (this.ws !== null) {
      this.ws.setTime(时间)
    }
  }
}
