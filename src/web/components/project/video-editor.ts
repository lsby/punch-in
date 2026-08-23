import { 组件基类 } from '../../base/base'
import { 主要按钮, 文本按钮 } from '../../components/general/base/base-button'
import { 普通输入框 } from '../../components/general/form/form-input'
import { 切换开关 } from '../../components/general/form/form-switch'
import { 关闭模态框, 显示模态框 } from '../../global/manager/modal-manager'
import { 创建元素 } from '../../global/tools/create-element'
import { 视频混音器组件 } from './video-editor/video-audio-mixer'
import { 视频音频分析器 } from './video-editor/video-editor-audio'
import { 视频录制器 } from './video-editor/video-editor-recorder'
import { 创建规则面板 } from './video-editor/video-editor-rule-panel'
import { 裁剪规则 } from './video-editor/video-editor-types'
import { 创建控制栏 } from './video-editor/video-editor-ui'
import { 计算排除片段 } from './video-editor/video-editor-utils'
import { 导出配置 } from './video-editor/video-exporter'
import { 视频片段, 视频预览组件 } from './video-editor/video-preview'
import { 视频时间轴组件 } from './video-editor/video-timeline'

type 发出事件类型 = {}
type 监听事件类型 = {}

export class 视频剪辑页面组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-editor', this)
  }

  private 预览组件: 视频预览组件 | null = null
  private 时间轴组件: 视频时间轴组件 | null = null
  private 混音器组件: 视频混音器组件 | null = null

  private 当前媒体流: MediaStream | null = null
  private 录制器 = new 视频录制器()
  private 音频分析器 = new 视频音频分析器()

  private 历史栈: { 切片列表: 视频片段[]; 实时波形数据: number[] }[] = []
  private 重做栈: { 切片列表: 视频片段[]; 实时波形数据: number[] }[] = []
  private 当前规则列表: 裁剪规则[] = []
  private 当前排除片段: { start: number; end: number }[] = []

  private async 弹出屏幕选择(): Promise<string | null> {
    let api = window.electronAPI
    if (api?.获取屏幕列表 === undefined) return null

    return new Promise(async (resolve) => {
      let 屏幕列表 = await api.获取屏幕列表()
      let 容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } })

      let 录制音频开关 = new 切换开关({ 标签: '录制系统音频', 值: true })

      let 内容容器 = 创建元素('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px',
          justifyContent: 'center',
          overflowY: 'auto',
          flex: '1',
        },
      })

      let 底部栏 = 创建元素('div', {
        style: {
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '16px 24px',
          alignItems: 'center',
          backgroundColor: '#1f2937',
          borderTop: '1px solid #374151',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.2)',
        },
      })
      底部栏.append(录制音频开关)

      容器.append(内容容器, 底部栏)

      屏幕列表.forEach((屏幕) => {
        let 卡片 = 创建元素('div', {
          style: {
            width: '200px',
            backgroundColor: '#2a2e36',
            borderRadius: '8px',
            padding: '12px',
            cursor: 'pointer',
            border: '2px solid transparent',
            transition: 'all 0.2s',
          },
        })
        卡片.onmouseenter = (): void => {
          卡片.style.borderColor = '#4f46e5'
        }
        卡片.onmouseleave = (): void => {
          卡片.style.borderColor = 'transparent'
        }
        卡片.onclick = async (): Promise<void> => {
          resolve(录制音频开关.获得值() ? `audio:${屏幕.id}` : 屏幕.id)
          await 关闭模态框()
        }

        let 缩略图 = 创建元素('img', {
          style: { width: '100%', height: '120px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '4px' },
        })
        缩略图.src = 屏幕.thumbnail

        let 名称 = 创建元素('div', {
          textContent: 屏幕.name,
          style: {
            color: '#fff',
            fontSize: '12px',
            marginTop: '8px',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        })

        卡片.append(缩略图, 名称)
        内容容器.append(卡片)
      })

      await 显示模态框(
        { 标题: '选择要录制的屏幕或窗口', 宽度: '800px', 高度: '600px', 关闭回调: () => resolve(null) },
        容器,
      )
    })
  }

  private 保存历史(): void {
    this.历史栈.push({ 切片列表: structuredClone(this.录制器.切片列表), 实时波形数据: [...this.录制器.实时波形数据] })
    this.重做栈 = []
    if (this.历史栈.length > 50) {
      this.历史栈.shift()
    }
  }

  private 应用状态(状态: { 切片列表: 视频片段[]; 实时波形数据: number[] }): void {
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

  private 执行撤销(): void {
    let 状态 = this.历史栈.pop()
    if (状态 !== undefined) {
      this.重做栈.push({ 切片列表: structuredClone(this.录制器.切片列表), 实时波形数据: [...this.录制器.实时波形数据] })
      this.应用状态(状态)
    }
  }

  private 执行重做(): void {
    let 状态 = this.重做栈.pop()
    if (状态 !== undefined) {
      this.历史栈.push({ 切片列表: structuredClone(this.录制器.切片列表), 实时波形数据: [...this.录制器.实时波形数据] })
      this.应用状态(状态)
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
      await this.弹出导出设置()
    }

    按钮集.撤销按钮.onclick = (): void => {
      this.执行撤销()
    }

    按钮集.重做按钮.onclick = (): void => {
      this.执行重做()
    }

    按钮集.选择屏幕按钮.onclick = async (): Promise<void> => {
      if (this.当前媒体流 !== null) return
      try {
        let stream: MediaStream
        if (window.electronAPI?.获取屏幕列表 !== undefined) {
          let 结果 = await this.弹出屏幕选择()
          if (结果 === null || 结果 === '') return

          let 是否要音频 = 结果.startsWith('audio:')
          let 屏幕ID = 是否要音频 ? 结果.replace('audio:', '') : 结果

          let constraints: any = {
            audio: 是否要音频 ? { mandatory: { chromeMediaSource: 'desktop' } } : false,
            video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 屏幕ID } },
          }

          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } else {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        }

        // 获得麦克风 (简单起见先直接获取)
        try {
          let micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          micStream.getAudioTracks().forEach((track) => stream.addTrack(track))
        } catch (e) {
          console.warn('获取麦克风失败或未授权', e)
        }

        this.当前媒体流 = stream
        按钮集.选择屏幕按钮.textContent = '✅ 已选择屏幕'
        按钮集.选择屏幕按钮.style.backgroundColor = '#059669'
        按钮集.选择屏幕按钮.style.cursor = 'not-allowed'

        // 启动混音器监听
        this.音频分析器.启动(stream)
      } catch (err) {
        console.error('获取屏幕失败', err)
      }
    }

    按钮集.录制按钮.onclick = (): void => {
      // 如果正在录制，则停止
      if (this.录制器.是否正在录制()) {
        this.录制器.停止()
        按钮集.录制按钮.textContent = '🔴 开始录制'
        按钮集.录制按钮.style.backgroundColor = '#dc2626'
        按钮集.录制按钮.style.borderColor = '#ef4444'
        按钮集.录制按钮.style.animation = 'none'
        按钮集.录制按钮.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
        return
      }

      // 如果未录制，则开始
      if (this.当前媒体流 === null) {
        alert('请先选择屏幕！')
        return
      }

      this.保存历史()

      let 混音流 = this.音频分析器.获得混音后的流(this.当前媒体流)
      this.录制器.开始录制(混音流, {
        获取当前时间: (): number => this.时间轴组件?.获取当前时间() ?? 0,
        即时计算音量: (): number => this.音频分析器.即时计算音量(),
        同步时间轴: (波形数据, 采样率, 当前时间): void => {
          this.时间轴组件?.设置峰值数据(波形数据, 采样率, false)
          this.时间轴组件?.同步进度(当前时间)
        },
        录制完成: (新切片列表, 波形数据, 结束时间): void => {
          this.预览组件?.设置播放列表(新切片列表)
          this.时间轴组件?.设置播放列表(新切片列表)
          this.时间轴组件?.设置峰值数据(波形数据, 100, false)
          this.重新计算排除片段()
          setTimeout(() => {
            this.时间轴组件?.同步进度(结束时间)
            this.预览组件?.跳转(结束时间)
          }, 50)
        },
      })

      按钮集.录制按钮.textContent = '⏹ 停止录制'
      按钮集.录制按钮.style.backgroundColor = '#4b5563'
      按钮集.录制按钮.style.borderColor = '#6b7280'
      按钮集.录制按钮.style.animation = 'pulse 1.5s infinite'
      按钮集.录制按钮.style.boxShadow = 'none'
    }

    // 事件联动
    this.预览组件.监听发出事件('进度变化', async (e): Promise<void> => {
      this.时间轴组件?.同步进度(e.detail)
    })

    this.时间轴组件.监听发出事件('进度跳转', async (e): Promise<void> => {
      this.预览组件?.跳转(e.detail)
    })
  }
  private async 弹出导出设置(): Promise<void> {
    return new Promise((resolve) => {
      let 容器 = 创建元素('div', {
        style: {
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          color: '#e5e7eb',
          maxHeight: '80vh',
          overflowY: 'auto',
        },
      })

      // 文件名
      let 文件名行 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } })
      文件名行.appendChild(
        创建元素('label', { textContent: '文件名', style: { fontSize: '14px', fontWeight: 'bold' } }),
      )
      let 文件名输入 = new 普通输入框({ 值: `录制_${new Date().getTime()}`, 占位符: '请输入文件名' })
      文件名行.appendChild(文件名输入)

      let 说明容器 = 创建元素('div', {
        style: {
          padding: '12px',
          backgroundColor: '#2a2e36',
          borderRadius: '8px',
          fontSize: '13px',
          lineHeight: '1.6',
          borderLeft: '4px solid #3b82f6',
        },
      })
      说明容器.innerHTML = `
        <div style="color: #60a5fa; font-weight: bold; margin-bottom: 4px;">原画导出</div>
        <div style="color: #9ca3af;">直接封装原始音视频，并应用当前启用的剪辑规则。</div>
        <div style="color: #9ca3af;">为保证视频可解码，裁剪起点会对齐到下一个关键帧。</div>
      `

      // 按钮
      let 底部 = 创建元素('div', {
        style: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' },
      })
      let 取消按钮 = new 文本按钮({
        文本: '取消',
        点击处理函数: async (): Promise<void> => {
          await 关闭模态框()
          resolve()
        },
      })
      let 确认导出按钮 = new 主要按钮({
        文本: '开始导出',
        点击处理函数: async (): Promise<void> => {
          let 配置: 导出配置 = { 文件名: 文件名输入.获得值() !== '' ? 文件名输入.获得值() : '未命名' }
          await 关闭模态框()
          try {
            this.重新计算排除片段()
            await this.录制器.导出MP4(this.当前排除片段, 配置)
          } catch (e) {
            alert(`导出失败: ${String(e)}`)
          }
          resolve()
        },
      })
      底部.append(取消按钮, 确认导出按钮)

      容器.append(文件名行, 说明容器, 底部)
      void 显示模态框({ 标题: '原画导出 MP4', 宽度: '480px', 高度: 'auto' }, 容器)
    })
  }
}
