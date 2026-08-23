import { 组件基类 } from '../../base/base'
import { 创建元素 } from '../../global/tools/create-element'
import { 视频混音器组件 } from './video-editor/video-audio-mixer'
import { 弹出Electron屏幕选择, 弹出浏览器采集设置 } from './video-editor/video-capture-dialog'
import { 视频音频分析器, 音频轨道来源 } from './video-editor/video-editor-audio'
import { 视频录制器 } from './video-editor/video-editor-recorder'
import { 创建规则面板 } from './video-editor/video-editor-rule-panel'
import { 裁剪规则 } from './video-editor/video-editor-types'
import { 创建控制栏, 控制栏按钮集合 } from './video-editor/video-editor-ui'
import { 计算排除片段 } from './video-editor/video-editor-utils'
import { 显示视频导出面板 } from './video-editor/video-export-dialog'
import { 视频片段, 视频预览组件 } from './video-editor/video-preview'
import { 视频本地存储 } from './video-editor/video-storage'
import { 显示存储管理面板, 格式化字节数, 格式化时长, 计算可录制秒数 } from './video-editor/video-storage-panel'
import { 视频时间轴组件 } from './video-editor/video-timeline'

type 发出事件类型 = {}
type 监听事件类型 = {}
type 编辑器状态 = { 切片列表: 视频片段[]; 实时波形数据: number[] }
type 历史状态 = { 切片列表: 视频片段[]; 实时波形数据: Float32Array<ArrayBuffer> }

let 最大历史内存字节数 = 32 * 1024 * 1024

export class 视频剪辑页面组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-editor', this)
  }

  private 预览组件: 视频预览组件 | null = null
  private 时间轴组件: 视频时间轴组件 | null = null
  private 混音器组件: 视频混音器组件 | null = null

  private 当前媒体流: MediaStream | null = null
  private 当前音频轨道来源: 音频轨道来源 = { 桌面音频轨道: null, 麦克风轨道: null }
  private 是否录制麦克风 = false
  private 本地存储 = new 视频本地存储()
  private 录制器 = new 视频录制器(this.本地存储)
  private 音频分析器 = new 视频音频分析器()
  private 控制栏按钮: 控制栏按钮集合 | null = null
  private 存储刷新定时器: number | null = null
  private 正在执行空间保护 = false
  private 已提示空间不足 = false

  private 历史栈: 历史状态[] = []
  private 重做栈: 历史状态[] = []
  private 当前规则列表: 裁剪规则[] = []
  private 当前排除片段: { start: number; end: number }[] = []

  private 保存历史(): void {
    this.历史栈.push(this.创建历史状态())
    this.重做栈 = []
    this.限制历史内存()
  }

  private 创建历史状态(): 历史状态 {
    return {
      切片列表: structuredClone(this.录制器.切片列表),
      实时波形数据: Float32Array.from(this.录制器.实时波形数据),
    }
  }

  private 限制历史内存(): void {
    while (this.历史栈.length + this.重做栈.length > 50 || this.计算历史内存() > 最大历史内存字节数) {
      if (this.历史栈.length > 0) this.历史栈.shift()
      else if (this.重做栈.length > 0) this.重做栈.shift()
      else break
    }
  }

  private 计算历史内存(): number {
    return [...this.历史栈, ...this.重做栈].reduce((总数, 状态) => 总数 + 状态.实时波形数据.byteLength, 0)
  }

  private 应用状态(状态: 编辑器状态): void {
    this.录制器.切片列表 = 状态.切片列表
    this.录制器.实时波形数据 = 状态.实时波形数据
    this.预览组件?.设置播放列表(this.录制器.切片列表)
    this.时间轴组件?.设置播放列表(this.录制器.切片列表)
    this.时间轴组件?.设置峰值数据(this.录制器.实时波形数据, 100, false)
    this.重新计算排除片段()

    // 跳转到最后一段的末尾，或者 0
    let 结束时间 = 0
    if (this.录制器.切片列表.length > 0) {
      let 最后一段 = this.录制器.切片列表[this.录制器.切片列表.length - 1]
      if (最后一段 !== undefined) {
        结束时间 = 最后一段.start + 最后一段.duration
      }
    }
    this.预览组件?.跳转(结束时间)
    this.时间轴组件?.同步进度(结束时间)
  }

  private async 执行撤销(): Promise<void> {
    let 状态 = this.历史栈.pop()
    if (状态 !== undefined) {
      this.重做栈.push(this.创建历史状态())
      this.应用状态({ 切片列表: 状态.切片列表, 实时波形数据: Array.from(状态.实时波形数据) })
      this.限制历史内存()
      await this.本地存储.保存时间轴(this.录制器.切片列表, this.录制器.实时波形数据)
    }
  }

  private async 执行重做(): Promise<void> {
    let 状态 = this.重做栈.pop()
    if (状态 !== undefined) {
      this.历史栈.push(this.创建历史状态())
      this.应用状态({ 切片列表: 状态.切片列表, 实时波形数据: Array.from(状态.实时波形数据) })
      this.限制历史内存()
      await this.本地存储.保存时间轴(this.录制器.切片列表, this.录制器.实时波形数据)
    }
  }

  private 重新计算排除片段(): void {
    let 峰值数据 = this.时间轴组件?.获取峰值数据()
    if (峰值数据 === null || 峰值数据 === undefined || 峰值数据.length === 0) {
      this.当前排除片段 = []
    } else {
      this.当前排除片段 = 计算排除片段(峰值数据.length / 100, 峰值数据, 100, this.当前规则列表)
    }
    this.时间轴组件?.设置排除片段(this.当前排除片段)
    this.预览组件?.设置排除片段(this.当前排除片段)
  }

  protected override async 当加载时(): Promise<void> {
    this.获得宿主样式().display = 'block'
    this.获得宿主样式().width = '100%'
    this.获得宿主样式().height = '100vh'

    let 容器 = 创建元素('div', {
      style: {
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        boxSizing: 'border-box',
        background: '#121212',
        color: '#fff',
        fontFamily: "'Inter', sans-serif",
        gap: '16px',
      },
    })

    // 顶部控制栏
    let 按钮集 = 创建控制栏(() => this.录制器.是否正在录制())
    this.控制栏按钮 = 按钮集

    // 中部主区域
    let 中部区域 = 创建元素('div', { style: { display: 'flex', flex: '1', gap: '16px', minHeight: '0' } })

    // 左侧主体 (预览 + 时间轴)
    let 左侧主体 = 创建元素('div', {
      style: { display: 'flex', flexDirection: 'column', flex: '1', gap: '16px', minWidth: '0' },
    })

    // 预览区域
    let 预览容器 = 创建元素('div', {
      style: {
        flex: '1',
        position: 'relative',
        minHeight: '0',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        backgroundColor: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
      },
    })
    this.预览组件 = new 视频预览组件()
    预览容器.append(this.预览组件)

    // 底部时间轴与混音器区域
    let 底部容器 = 创建元素('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: '0' },
    })

    this.时间轴组件 = new 视频时间轴组件()
    this.时间轴组件.style.height = '200px'

    let 混音器包装 = 创建元素('div', { style: { display: 'none' } })
    this.混音器组件 = new 视频混音器组件()
    this.音频分析器.设置混音器(this.混音器组件)
    混音器包装.append(this.混音器组件)

    // 规则面板 (放在右侧)
    let 规则面板包装 = 创建元素('div', { style: { display: 'none', width: '320px', flexShrink: '0', height: '100%' } })
    let 规则面板 = 创建规则面板((规则列表) => {
      this.当前规则列表 = [...规则列表]
      this.重新计算排除片段()
    })
    规则面板包装.append(规则面板.面板元素)

    底部容器.append(this.时间轴组件, 混音器包装)
    左侧主体.append(预览容器, 底部容器)
    中部区域.append(左侧主体, 规则面板包装)

    容器.append(按钮集.控制栏, 中部区域)
    this.shadow.append(容器)

    let 恢复状态 = await this.本地存储.初始化()
    this.录制器.切片列表 = 恢复状态.片段列表
    this.录制器.实时波形数据 = 恢复状态.实时波形数据
    this.应用状态({ 切片列表: 恢复状态.片段列表, 实时波形数据: 恢复状态.实时波形数据 })
    await this.清理未引用片段()
    await this.刷新存储状态()
    this.存储刷新定时器 = window.setInterval((): void => {
      void this.刷新存储状态()
    }, 10_000)

    // ── 事件绑定 ──

    按钮集.切换混音器按钮.onclick = (): void => {
      if (混音器包装.style.display === 'none') {
        混音器包装.style.display = 'block'
      } else {
        混音器包装.style.display = 'none'
      }
    }

    按钮集.剪辑规则按钮.onclick = (): void => {
      if (规则面板包装.style.display === 'none') {
        规则面板包装.style.display = 'block'
      } else {
        规则面板包装.style.display = 'none'
      }
    }

    按钮集.导出按钮.onclick = async (): Promise<void> => {
      if (this.录制器.是否忙碌()) {
        alert('请等待当前录制完成收尾')
        return
      }
      await this.弹出导出设置()
    }

    按钮集.存储按钮.onclick = async (): Promise<void> => {
      await 显示存储管理面板(this.本地存储, this.录制器.获得预计每秒字节数(), {
        是否允许删除: (): boolean => this.录制器.是否忙碌() === false,
        当前会话已删除: async (): Promise<void> => {
          this.历史栈 = []
          this.重做栈 = []
          this.录制器.切片列表 = []
          this.录制器.实时波形数据 = []
          this.应用状态({ 切片列表: [], 实时波形数据: [] })
          await this.刷新存储状态()
        },
      })
    }

    按钮集.撤销按钮.onclick = async (): Promise<void> => {
      if (this.录制器.是否忙碌()) return
      await this.执行撤销()
    }

    按钮集.重做按钮.onclick = async (): Promise<void> => {
      if (this.录制器.是否忙碌()) return
      await this.执行重做()
    }

    按钮集.选择屏幕按钮.onclick = async (): Promise<void> => {
      if (this.录制器.是否忙碌()) {
        alert('请先停止当前录制')
        return
      }
      if (this.当前媒体流 !== null) {
        await this.停止媒体采集()
        return
      }
      try {
        let stream: MediaStream
        let 桌面音频轨道: MediaStreamTrack | null = null
        if (window.electronAPI?.获取屏幕列表 !== undefined) {
          let 结果 = await 弹出Electron屏幕选择()
          if (结果 === null) return
          let constraints: any = {
            audio: 结果.录制系统音频 ? { mandatory: { chromeMediaSource: 'desktop' } } : false,
            video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 结果.屏幕ID } },
          }
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          桌面音频轨道 = stream.getAudioTracks()[0] ?? null
          this.是否录制麦克风 = 结果.录制麦克风
        } else {
          let 设置 = await 弹出浏览器采集设置()
          if (设置 === null) return
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: 设置.录制系统音频 })
          桌面音频轨道 = stream.getAudioTracks()[0] ?? null
          this.是否录制麦克风 = 设置.录制麦克风
        }
        this.当前媒体流 = stream
        this.当前音频轨道来源 = { 桌面音频轨道, 麦克风轨道: null }
        let 视频轨道 = stream.getVideoTracks()[0]
        if (视频轨道 !== undefined) {
          视频轨道.onended = (): void => {
            void this.停止媒体采集()
          }
        }
        按钮集.选择屏幕按钮.textContent = '停止屏幕采集'
        按钮集.选择屏幕按钮.style.backgroundColor = '#059669'
        按钮集.选择屏幕按钮.style.color = '#fff'
        await this.音频分析器.启动(this.当前音频轨道来源)
        this.预览组件?.设置视频流(stream)
      } catch (err) {
        console.error('获取屏幕失败', err)
        await this.停止媒体采集()
        alert(`获取屏幕失败: ${String(err)}`)
      }
    }

    按钮集.录制按钮.onclick = async (): Promise<void> => {
      if (this.录制器.是否正在录制()) {
        按钮集.录制按钮.disabled = true
        按钮集.录制按钮.textContent = '正在保存'
        try {
          await this.录制器.停止()
        } catch (错误) {
          alert(`停止录制失败: ${String(错误)}`)
        } finally {
          this.设置录制按钮状态(false)
          await this.刷新存储状态()
        }
        return
      }
      if (this.录制器.是否忙碌()) return
      if (this.当前媒体流 === null) {
        alert('请先选择屏幕')
        return
      }
      this.保存历史()
      按钮集.录制按钮.disabled = true
      按钮集.录制按钮.textContent = '正在启动'
      try {
        await this.启动麦克风采集()
        let 混音流 = this.音频分析器.获得混音后的流(this.当前媒体流)
        this.预览组件?.设置视频流(this.当前媒体流)
        await this.录制器.开始录制(混音流, {
          获取当前时间: (): number => this.时间轴组件?.获取当前时间() ?? 0,
          提取波形样本: (): number[] => this.音频分析器.提取波形样本(),
          同步时间轴: (波形数据, 采样率, 当前时间): void => {
            this.时间轴组件?.设置峰值数据(波形数据, 采样率, false)
            this.时间轴组件?.同步进度(当前时间)
          },
          录制完成: async (新切片列表, 波形数据, 结束时间): Promise<void> => {
            await this.停止麦克风采集()
            this.预览组件?.设置视频流(null)
            this.预览组件?.设置播放列表(新切片列表)
            this.时间轴组件?.设置播放列表(新切片列表)
            this.时间轴组件?.设置峰值数据(波形数据, 100, false)
            this.重新计算排除片段()
            setTimeout((): void => {
              this.时间轴组件?.同步进度(结束时间)
              this.预览组件?.跳转(结束时间)
            }, 50)
            await this.清理未引用片段()
          },
          录制错误: (错误): void => {
            void this.停止麦克风采集().catch((停止错误: unknown): void => console.error('停止麦克风采集失败', 停止错误))
            this.设置录制按钮状态(false)
            alert(`录制失败: ${错误.message}`)
          },
        })
        this.设置录制按钮状态(true)
      } catch (错误) {
        this.历史栈.pop()
        await this.停止麦克风采集()
        this.设置录制按钮状态(false)
        alert(`开始录制失败: ${String(错误)}`)
      }
    }

    // 事件联动
    this.预览组件.监听发出事件('进度变化', async (e): Promise<void> => {
      this.时间轴组件?.同步进度(e.detail)
    })

    this.时间轴组件.监听发出事件('进度跳转', async (e): Promise<void> => {
      this.预览组件?.跳转(e.detail)
    })
  }

  protected override async 当卸载时(): Promise<void> {
    if (this.存储刷新定时器 !== null) clearInterval(this.存储刷新定时器)
    this.存储刷新定时器 = null
    try {
      if (this.录制器.是否正在录制()) await this.录制器.停止()
      else if (this.录制器.是否忙碌()) await this.录制器.取消()
    } finally {
      await this.停止媒体采集()
      this.本地存储.释放全部URL()
    }
  }

  private async 获取麦克风轨道(): Promise<MediaStreamTrack> {
    try {
      let 麦克风流 = await navigator.mediaDevices.getUserMedia({ audio: true })
      let 麦克风轨道 = 麦克风流.getAudioTracks()[0]
      if (麦克风轨道 === undefined) throw new Error('没有可用的麦克风音轨')
      return 麦克风轨道
    } catch (错误) {
      throw new Error(`获取麦克风失败或未授权: ${String(错误)}`)
    }
  }

  private async 启动麦克风采集(): Promise<void> {
    if (this.是否录制麦克风 === false || this.当前媒体流 === null || this.当前音频轨道来源.麦克风轨道 !== null) return
    let 麦克风轨道 = await this.获取麦克风轨道()
    this.当前媒体流.addTrack(麦克风轨道)
    this.当前音频轨道来源 = { ...this.当前音频轨道来源, 麦克风轨道 }
    try {
      await this.音频分析器.启动(this.当前音频轨道来源)
    } catch (错误) {
      this.当前媒体流.removeTrack(麦克风轨道)
      麦克风轨道.stop()
      this.当前音频轨道来源 = { ...this.当前音频轨道来源, 麦克风轨道: null }
      throw 错误
    }
  }

  private async 停止麦克风采集(): Promise<void> {
    let 麦克风轨道 = this.当前音频轨道来源.麦克风轨道
    if (麦克风轨道 === null) return
    this.当前媒体流?.removeTrack(麦克风轨道)
    麦克风轨道.stop()
    this.当前音频轨道来源 = { ...this.当前音频轨道来源, 麦克风轨道: null }
    try {
      await this.音频分析器.启动(this.当前音频轨道来源)
    } catch (错误) {
      console.error('恢复桌面音频分析失败', 错误)
    }
  }

  private async 停止媒体采集(): Promise<void> {
    if (this.录制器.是否正在录制()) {
      try {
        await this.录制器.停止()
      } catch (错误) {
        console.error('采集结束时保存录制失败', 错误)
      }
    }
    let stream = this.当前媒体流
    this.当前媒体流 = null
    this.是否录制麦克风 = false
    this.当前音频轨道来源 = { 桌面音频轨道: null, 麦克风轨道: null }
    if (stream !== null) {
      for (let track of stream.getTracks()) {
        track.onended = null
        track.stop()
      }
    }
    await this.音频分析器.停止()
    this.预览组件?.设置视频流(null)
    this.设置录制按钮状态(false)
    if (this.录制器.切片列表.length > 0) this.预览组件?.设置播放列表(this.录制器.切片列表)
    let 按钮 = this.控制栏按钮?.选择屏幕按钮
    if (按钮 !== undefined) {
      按钮.textContent = '选择录制屏幕'
      按钮.style.backgroundColor = '#2d333b'
      按钮.style.color = '#adbac7'
    }
  }

  private 设置录制按钮状态(正在录制: boolean): void {
    let 按钮 = this.控制栏按钮?.录制按钮
    if (按钮 === undefined) return
    按钮.disabled = false
    按钮.textContent = 正在录制 ? '停止录制' : '开始录制'
    按钮.style.backgroundColor = 正在录制 ? '#4b5563' : '#dc2626'
    按钮.style.borderColor = 正在录制 ? '#6b7280' : '#ef4444'
    按钮.style.animation = 正在录制 ? 'pulse 1.5s infinite' : 'none'
    按钮.style.boxShadow = 正在录制 ? 'none' : '0 2px 4px rgba(0,0,0,0.2)'
  }

  private async 刷新存储状态(): Promise<void> {
    let 按钮 = this.控制栏按钮?.存储按钮
    if (按钮 === undefined) return
    try {
      let 统计 = await this.本地存储.获得统计()
      let 可录秒数 = 计算可录制秒数(统计, this.录制器.获得预计每秒字节数())
      按钮.textContent = `本地 ${格式化字节数(统计.录制字节数)} · 可录 ${格式化时长(可录秒数)}`
      if (this.录制器.是否正在录制() && 可录秒数 <= 120 && this.正在执行空间保护 === false) {
        this.正在执行空间保护 = true
        try {
          alert('本地存储空间预计不足 2 分钟，录制将安全停止')
          await this.录制器.停止()
          this.设置录制按钮状态(false)
        } finally {
          this.正在执行空间保护 = false
        }
      } else if (this.录制器.是否正在录制() && 可录秒数 <= 600 && this.已提示空间不足 === false) {
        this.已提示空间不足 = true
        alert('本地存储空间预计不足 10 分钟，请及时停止并清理或导出录制')
      } else if (可录秒数 > 600) this.已提示空间不足 = false
    } catch (错误) {
      按钮.textContent = '本地存储状态不可用'
      console.error('读取本地存储状态失败', 错误)
    }
  }

  private async 清理未引用片段(): Promise<void> {
    let 保留片段 = [
      ...this.录制器.切片列表,
      ...this.历史栈.flatMap((状态) => 状态.切片列表),
      ...this.重做栈.flatMap((状态) => 状态.切片列表),
    ]
    await this.本地存储.清理未引用片段(保留片段)
  }

  private async 弹出导出设置(): Promise<void> {
    await 显示视频导出面板(async (配置): Promise<void> => {
      this.重新计算排除片段()
      await this.录制器.导出MP4(this.当前排除片段, 配置)
      await this.刷新存储状态()
    })
  }
}
