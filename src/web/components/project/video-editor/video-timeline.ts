import { 组件基类 } from '../../../base/base'
import { API管理器 } from '../../../global/manager/api-manager'
import { 绘制刻度尺, 绘制波形 } from './video-timeline-canvas'
import { 构建时间轴UI } from './video-timeline-ui'
import { 格式化时间 } from './video-timeline-utils'

type 发出事件类型 = { 进度跳转: number }
type 监听事件类型 = {}

export class 视频时间轴组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-timeline', this)
  }

  private 轨道容器: HTMLElement | null = null
  private 内容层: HTMLElement | null = null
  private 交互层: HTMLElement | null = null
  private 画布容器: HTMLElement | null = null
  private 刻度尺画布: HTMLCanvasElement | null = null
  private 波形画布: HTMLCanvasElement | null = null
  private 播放头元素: HTMLElement | null = null
  private 波形加载遮罩: HTMLElement | null = null
  private 预览分贝标签: HTMLElement | null = null

  private 默认缩放: number = 20
  private 当前缩放: number = this.默认缩放
  private 是否正在拖拽进度: boolean = false
  private 峰值数据: number[] | null = null
  private 真实时长: number = 0
  private 当前时间: number = 0
  private 排除片段列表: { start: number; end: number }[] = []
  private 全局最大峰值: number = 0

  private 预览视频: HTMLVideoElement | null = null
  private 预览窗: HTMLElement | null = null
  private 预览画布: HTMLCanvasElement | null = null
  private 预览时间标签: HTMLElement | null = null
  private 是否正在寻求预览: boolean = false

  private 观察器: ResizeObserver | null = null
  private 动画请求: number | null = null

  protected override async 当加载时(): Promise<void> {
    this.获得宿主样式().display = 'block'
    this.获得宿主样式().width = '100%'

    let UI = 构建时间轴UI(this.shadow)
    this.轨道容器 = UI.轨道容器
    this.内容层 = UI.内容层
    this.交互层 = UI.交互层
    this.画布容器 = UI.画布容器
    this.刻度尺画布 = UI.刻度尺画布
    this.波形画布 = UI.波形画布
    this.播放头元素 = UI.播放头元素
    this.波形加载遮罩 = UI.波形加载遮罩
    this.预览窗 = UI.预览窗
    this.预览画布 = UI.预览画布
    this.预览时间标签 = UI.预览时间标签
    this.预览分贝标签 = UI.预览分贝标签

    this.轨道容器.onmouseenter = (): void => {
      if (this.预览视频 !== null && this.预览窗 !== null) this.预览窗.style.display = 'flex'
    }

    this.轨道容器.onmouseleave = (): void => {
      if (this.预览窗 !== null) this.预览窗.style.display = 'none'
    }

    let 获取当前时间 = (e: MouseEvent): number => {
      if (this.轨道容器 === null) return 0
      let 容器矩形 = this.轨道容器.getBoundingClientRect()
      let 相对X = e.clientX - 容器矩形.left + this.轨道容器.scrollLeft
      let 时间 = 相对X / this.当前缩放
      return Math.max(0, Math.min(this.真实时长, 时间))
    }

    let 容器移动逻辑 = (e: MouseEvent): void => {
      if (
        this.预览窗 === null ||
        this.轨道容器 === null ||
        this.预览视频 === null ||
        this.是否正在拖拽进度 ||
        this.真实时长 <= 0
      )
        return
      this.预览窗.style.display = 'flex'

      let 容器矩形 = this.轨道容器.getBoundingClientRect()
      let 时间 = 获取当前时间(e)

      this.预览窗.style.left = `${e.clientX - 容器矩形.left}px`

      if (this.预览时间标签 !== null) this.预览时间标签.textContent = 格式化时间(时间)

      if (this.预览分贝标签 !== null && this.峰值数据 !== null && this.全局最大峰值 > 0) {
        let 窗口大小 = 0.1 // 100ms 窗口
        let 半窗口点数 = Math.floor((窗口大小 * 100) / 2)
        let 中心索引 = Math.floor(时间 * 100)
        let 起始索引 = Math.max(0, 中心索引 - 半窗口点数)
        let 结束索引 = Math.min(this.峰值数据.length, 中心索引 + 半窗口点数)

        let 窗口最大 = 0
        for (let i = 起始索引; i < 结束索引; i++) {
          let p = this.峰值数据[i] ?? 0
          if (p > 窗口最大) 窗口最大 = p
        }

        let 相对百分比 = (窗口最大 / this.全局最大峰值) * 100
        let 强度 = 窗口最大 > 0 ? Math.max(0, 100 + 20 * Math.log10(窗口最大 / this.全局最大峰值)) : 0
        this.预览分贝标签.textContent = `${相对百分比.toFixed(1)}% / ${强度.toFixed(1)} dB`
      }

      if (!this.是否正在寻求预览) {
        this.是否正在寻求预览 = true
        this.预览视频.currentTime = 时间
      }
    }

    this.内容层.onmousemove = 容器移动逻辑
    this.轨道容器.onmousemove = 容器移动逻辑

    this.交互层.onmousedown = (e: MouseEvent): void => {
      if (this.轨道容器 === null || this.真实时长 <= 0) return
      if (e.button === 0) {
        this.是否正在拖拽进度 = true
        if (this.预览窗 !== null) this.预览窗.style.display = 'none'

        let 执行更新 = (event: MouseEvent): void => {
          let 时间 = 获取当前时间(event)
          this.派发事件('进度跳转', 时间)
          this.当前时间 = 时间
          this.更新播放头()
        }

        执行更新(e)

        let 处理移动 = (moveEvent: MouseEvent): void => {
          if (this.是否正在拖拽进度) 执行更新(moveEvent)
        }
        let 处理抬起 = (): void => {
          this.是否正在拖拽进度 = false
          window.removeEventListener('mousemove', 处理移动)
          window.removeEventListener('mouseup', 处理抬起)
        }
        window.addEventListener('mousemove', 处理移动)
        window.addEventListener('mouseup', 处理抬起)
      } else if (e.button === 2) {
        let 起始X = e.clientX
        let 起始Scroll = this.轨道容器.scrollLeft
        this.轨道容器.style.cursor = 'grabbing'

        if (this.预览窗 !== null) this.预览窗.style.display = 'none'

        let 处理移动 = (moveEvent: MouseEvent): void => {
          let 差值 = moveEvent.clientX - 起始X
          if (this.轨道容器 !== null) {
            this.轨道容器.scrollLeft = 起始Scroll - 差值
          }
        }
        let 处理抬起 = (): void => {
          if (this.轨道容器 !== null) this.轨道容器.style.cursor = 'default'
          window.removeEventListener('mousemove', 处理移动)
          window.removeEventListener('mouseup', 处理抬起)
        }
        window.addEventListener('mousemove', 处理移动)
        window.addEventListener('mouseup', 处理抬起)
      }
    }

    this.轨道容器.onmousedown = (e: MouseEvent): void => {
      if (this.轨道容器 !== null && (e.offsetX > this.轨道容器.clientWidth || e.offsetY > this.轨道容器.clientHeight)) {
        return
      }
      if (e.target === this.轨道容器 || e.target === this.内容层) {
        this.交互层?.dispatchEvent(new MouseEvent('mousedown', e))
      }
    }

    this.轨道容器.onwheel = (e: WheelEvent): void => {
      e.preventDefault()

      if (e.ctrlKey || e.metaKey || e.deltaY !== 0) {
        let 缩放因子 = e.deltaY > 0 ? 0.9 : 1.1
        let 新缩放 = this.当前缩放 * 缩放因子

        let 锚点时间 = 获取当前时间(e as unknown as MouseEvent)
        if (this.轨道容器 === null) throw new Error('意外的空值')
        let 容器矩形 = this.轨道容器.getBoundingClientRect()
        let 锚点相对视口X = e.clientX - 容器矩形.left

        this.执行缩放(新缩放, 锚点时间, 锚点相对视口X)
      } else if (e.deltaX !== 0) {
        if (this.轨道容器 === null) throw new Error('意外的空值')
        this.轨道容器.scrollLeft += e.deltaX
      }
    }

    this.轨道容器.onscroll = (): void => {
      this.触发重绘()
    }

    this.轨道容器.oncontextmenu = (e: MouseEvent): void => {
      e.preventDefault()
    }

    this.观察器 = new ResizeObserver((): void => {
      this.调整画布尺寸()
    })
    this.观察器.observe(this.轨道容器)
    window.addEventListener('resize', this.调整画布尺寸.bind(this))

    // 立即触发一次重绘，确保初始化时可见
    this.调整画布尺寸()
  }

  protected override async 当卸载时(): Promise<void> {
    if (this.观察器 !== null && this.轨道容器 !== null) {
      this.观察器.unobserve(this.轨道容器)
      this.观察器.disconnect()
    }
    window.removeEventListener('resize', this.调整画布尺寸.bind(this))
    if (this.预览视频 !== null) {
      this.预览视频.src = ''
      this.预览视频.load()
      this.预览视频 = null
    }
  }

  private 调整画布尺寸(): void {
    if (this.画布容器 === null || this.刻度尺画布 === null || this.波形画布 === null) return
    let rect = this.画布容器.getBoundingClientRect()
    let dpr = (window.devicePixelRatio as number | undefined) ?? 1

    let newWidth = rect.width * dpr
    let newHeight = (rect.height - 32) * dpr
    if (this.波形画布.width !== newWidth || this.波形画布.height !== newHeight) {
      this.刻度尺画布.width = newWidth
      this.刻度尺画布.height = 32 * dpr
      this.波形画布.width = newWidth
      this.波形画布.height = newHeight
      this.触发重绘()
    }
  }

  private 触发重绘(): void {
    if (this.动画请求 !== null) {
      return
    }
    this.动画请求 = requestAnimationFrame((): void => {
      this.动画请求 = null
      let 参数 = {
        当前缩放: this.当前缩放,
        真实时长: this.真实时长,
        峰值数据: this.峰值数据,
        滚动距离: this.轨道容器?.scrollLeft ?? 0,
        视口宽度: this.轨道容器?.clientWidth ?? 0,
        像素比: (window.devicePixelRatio as number | undefined) ?? 1,
      }
      if (this.刻度尺画布 !== null) 绘制刻度尺(this.刻度尺画布, 参数)
      if (this.波形画布 !== null) 绘制波形(this.波形画布, 参数)
      this.更新播放头()
    })
  }

  public 设置排除片段(片段: { start: number; end: number }[]): void {
    this.排除片段列表 = 片段
    this.渲染排除片段()
  }

  private 渲染排除片段(): void {
    if (this.交互层 === null) return
    this.交互层.innerHTML = ''
    for (let p of this.排除片段列表) {
      let startX = p.start * this.当前缩放
      let w = (p.end - p.start) * this.当前缩放
      let div = document.createElement('div')
      div.style.position = 'absolute'
      div.style.left = `${startX}px`
      div.style.width = `${w}px`
      div.style.top = '0'
      div.style.height = '100%'
      div.style.background = `repeating-linear-gradient(
        45deg,
        rgba(239, 68, 68, 0.05),
        rgba(239, 68, 68, 0.05) 10px,
        rgba(239, 68, 68, 0.15) 10px,
        rgba(239, 68, 68, 0.15) 20px
      )`
      div.style.borderLeft = '1px solid rgba(239, 68, 68, 0.4)'
      div.style.borderRight = '1px solid rgba(239, 68, 68, 0.4)'
      div.style.pointerEvents = 'none'
      this.交互层.append(div)
    }
  }

  private 执行缩放(值: number, 锚点时间?: number, 锚点偏移?: number): void {
    let 最大缩放 = 1000
    let 实际缩放 = Math.max(0.1, Math.min(值, 最大缩放))
    let 旧缩放 = this.当前缩放
    this.当前缩放 = 实际缩放

    let 额外宽度 = this.轨道容器?.clientWidth ?? 0
    let 总宽度 = Math.max(0, this.真实时长) * 实际缩放 + 额外宽度
    if (this.内容层 !== null) this.内容层.style.width = `${总宽度}px`
    if (this.交互层 !== null) this.交互层.style.width = `${总宽度}px`

    if (this.轨道容器 === null || this.真实时长 <= 0) {
      this.渲染排除片段()
      this.触发重绘()
      return
    }

    let 实际锚点时间 = 锚点时间 ?? this.当前时间
    let 实际锚点偏移 = 锚点偏移 ?? 实际锚点时间 * 旧缩放 - this.轨道容器.scrollLeft

    this.当前缩放 = 实际缩放

    总宽度 = this.真实时长 * 实际缩放 + 额外宽度
    if (this.内容层 !== null) this.内容层.style.width = `${总宽度}px`
    if (this.交互层 !== null) this.交互层.style.width = `${总宽度}px`

    this.轨道容器.scrollLeft = 实际锚点时间 * 实际缩放 - 实际锚点偏移

    this.渲染排除片段()
    this.触发重绘()
  }

  public async 设置资源(url: string, 文件名?: string, 真实路径?: string): Promise<void> {
    if (this.波形加载遮罩 !== null) {
      this.波形加载遮罩.style.display = 'flex'
    }
    if (this.轨道容器 !== null) {
      this.轨道容器.scrollLeft = 0
    }

    try {
      this.峰值数据 = []
      this.真实时长 = 0
      this.当前时间 = 0
      this.排除片段列表 = []
      this.渲染排除片段()
      this.触发重绘()

      if (真实路径 !== undefined) {
        try {
          let 结果 = await API管理器.请求postJson并处理错误('/api/project/get-video-peaks', {
            videoPath: 真实路径,
            samplesPerSecond: 100,
          })
          this.峰值数据 = 结果.peaks
          this.真实时长 = this.峰值数据.length / 100
          this.全局最大峰值 = 0
          for (let p of this.峰值数据) {
            if (p > this.全局最大峰值) this.全局最大峰值 = p
          }
        } catch (e) {
          console.error('获取峰值数据失败:', e)
        }
      }

      if (this.真实时长 > 0) {
        let 视口宽度 = this.轨道容器?.clientWidth ?? 1000
        this.当前缩放 = Math.max(this.默认缩放, 视口宽度 / this.真实时长)
        this.执行缩放(this.当前缩放)
      }
    } finally {
      if (this.波形加载遮罩 !== null) {
        this.波形加载遮罩.style.display = 'none'
      }
    }

    if (this.预览视频 === null) {
      this.预览视频 = document.createElement('video')
      this.预览视频.muted = true
      this.预览视频.onseeked = (): void => {
        if (this.预览画布 !== null && this.预览视频 !== null) {
          let 上下文 = this.预览画布.getContext('2d')
          if (上下文 !== null) {
            上下文.drawImage(this.预览视频, 0, 0, 180, 101)
          }
        }
        this.是否正在寻求预览 = false
      }
    }
    this.预览视频.src = url

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
    if (this.是否正在拖拽进度) return
    this.当前时间 = 时间
    this.更新播放头()

    if (this.轨道容器 !== null) {
      let x = 时间 * this.当前缩放
      let viewWidth = this.轨道容器.clientWidth
      let sl = this.轨道容器.scrollLeft
      if (x > sl + viewWidth * 0.8) {
        this.轨道容器.scrollLeft = x - viewWidth * 0.8
      } else if (x < sl) {
        this.轨道容器.scrollLeft = x
      }
    }
  }

  public 获取峰值数据(): number[] | null {
    return this.峰值数据
  }

  public 获取当前时间(): number {
    return this.当前时间
  }

  public 设置峰值数据(数据: number[], 样本率: number = 100, 自动适应缩放: boolean = true): void {
    this.峰值数据 = 数据
    this.真实时长 = 数据.length / 样本率
    this.全局最大峰值 = 0
    for (let p of this.峰值数据) {
      if (p > this.全局最大峰值) this.全局最大峰值 = p
    }
    if (this.真实时长 > 0) {
      if (自动适应缩放) {
        let 视口宽度 = this.轨道容器?.clientWidth ?? 1000
        this.当前缩放 = Math.max(this.默认缩放, 视口宽度 / this.真实时长)
      }
      this.执行缩放(this.当前缩放)
    }
    this.触发重绘()
  }

  private 更新播放头(): void {
    if (this.播放头元素 === null) return
    let scrollLeft = this.轨道容器?.scrollLeft ?? 0
    let logicX = this.当前时间 * this.当前缩放 - scrollLeft
    if (logicX < -10 || logicX > (this.轨道容器?.clientWidth ?? 0) + 10) {
      this.播放头元素.style.display = 'none'
    } else {
      this.播放头元素.style.display = 'block'
      this.播放头元素.style.transform = `translateX(${logicX}px)`
    }
  }
}
