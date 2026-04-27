import { 组件基类 } from '../../base/base'
import { 关闭模态框, 显示模态框 } from '../../global/manager/modal-manager'
import { 创建元素 } from '../../global/tools/create-element'
import { 视频混音器组件 } from './video-editor/video-audio-mixer'
import { 视频导出器 } from './video-editor/video-exporter'
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
  private 导出器 = new 视频导出器()

  private 当前媒体流: MediaStream | null = null
  private 录制器: MediaRecorder | null = null
  private 录制的数据块: Blob[] = []

  private 录制循环ID: number | null = null
  private 实时波形数据: number[] = []
  private 录制开始时间: number = 0
  private 音频上下文: AudioContext | null = null
  private 切片列表: 视频片段[] = []
  private 历史栈: { 切片列表: 视频片段[]; 实时波形数据: number[] }[] = []
  private 重做栈: { 切片列表: 视频片段[]; 实时波形数据: number[] }[] = []

  private async 弹出屏幕选择(): Promise<string | null> {
    let api = window.electronAPI
    if (api?.获取屏幕列表 === undefined) return null

    return new Promise(async (resolve) => {
      let 屏幕列表 = await api.获取屏幕列表()
      let 内容容器 = 创建元素('div', {
        style: { display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '20px', justifyContent: 'center' },
      })

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
          resolve(屏幕.id)
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
        内容容器,
      )
    })
  }

  private 保存历史(): void {
    this.历史栈.push({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      切片列表: JSON.parse(JSON.stringify(this.切片列表)),
      实时波形数据: [...this.实时波形数据],
    })
    this.重做栈 = []
    if (this.历史栈.length > 50) {
      this.历史栈.shift()
    }
  }

  private 应用状态(状态: { 切片列表: 视频片段[]; 实时波形数据: number[] }): void {
    this.切片列表 = 状态.切片列表
    this.实时波形数据 = 状态.实时波形数据
    this.预览组件?.设置播放列表(this.切片列表)
    this.时间轴组件?.设置峰值数据(this.实时波形数据, 100, false)

    // 跳转到最后一段的末尾，或者 0
    let 结束时间 = 0
    if (this.切片列表.length > 0) {
      let 最后一段 = this.切片列表[this.切片列表.length - 1]
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
      this.重做栈.push({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        切片列表: JSON.parse(JSON.stringify(this.切片列表)),
        实时波形数据: [...this.实时波形数据],
      })
      this.应用状态(状态)
    }
  }

  private 执行重做(): void {
    let 状态 = this.重做栈.pop()
    if (状态 !== undefined) {
      this.历史栈.push({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        切片列表: JSON.parse(JSON.stringify(this.切片列表)),
        实时波形数据: [...this.实时波形数据],
      })
      this.应用状态(状态)
    }
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

    // 顶部控制栏（录制按钮等）
    let 顶部控制栏 = 创建元素('div', {
      style: {
        display: 'flex',
        gap: '12px',
        padding: '12px',
        backgroundColor: '#1a1e23',
        borderRadius: '12px',
        border: '1px solid #333',
        alignItems: 'center',
      },
    })

    let 录制按钮 = 创建元素('button', {
      textContent: '🔴 开始录制',
      style: {
        padding: '8px 24px',
        backgroundColor: '#dc2626',
        color: '#fff',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      },
    })
    录制按钮.onmouseenter = (): void => {
      let 正在录制 = this.录制器 !== null && this.录制器.state === 'recording'
      录制按钮.style.backgroundColor = 正在录制 ? '#6b7280' : '#ef4444'
      录制按钮.style.transform = 'translateY(-1px)'
      录制按钮.style.boxShadow = 正在录制 ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)'
    }
    录制按钮.onmouseleave = (): void => {
      let 正在录制 = this.录制器 !== null && this.录制器.state === 'recording'
      录制按钮.style.backgroundColor = 正在录制 ? '#4b5563' : '#dc2626'
      录制按钮.style.transform = 'translateY(0)'
      录制按钮.style.boxShadow = 正在录制 ? 'none' : '0 2px 4px rgba(0,0,0,0.2)'
    }

    let 选择屏幕按钮 = 创建元素('button', {
      textContent: '🖥 选择录制屏幕',
      style: {
        padding: '8px 16px',
        backgroundColor: '#2d333b',
        color: '#adbac7',
        border: '1px solid #444c56',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        marginLeft: 'auto',
        outline: 'none',
        transition: 'all 0.2s',
      },
    })
    选择屏幕按钮.onmouseenter = (): void => {
      选择屏幕按钮.style.backgroundColor = '#444c56'
      选择屏幕按钮.style.borderColor = '#768390'
    }
    选择屏幕按钮.onmouseleave = (): void => {
      选择屏幕按钮.style.backgroundColor = '#2d333b'
      选择屏幕按钮.style.borderColor = '#444c56'
    }

    let 撤销按钮 = 创建元素('button', {
      textContent: '↩️ 撤销',
      style: {
        padding: '8px 16px',
        backgroundColor: '#2d333b',
        color: '#adbac7',
        border: '1px solid #444c56',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.2s',
      },
    })
    撤销按钮.onmouseenter = (): void => {
      撤销按钮.style.backgroundColor = '#444c56'
      撤销按钮.style.borderColor = '#768390'
    }
    撤销按钮.onmouseleave = (): void => {
      撤销按钮.style.backgroundColor = '#2d333b'
      撤销按钮.style.borderColor = '#444c56'
    }

    let 重做按钮 = 创建元素('button', {
      textContent: '↪️ 重做',
      style: {
        padding: '8px 16px',
        backgroundColor: '#2d333b',
        color: '#adbac7',
        border: '1px solid #444c56',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.2s',
      },
    })
    重做按钮.onmouseenter = (): void => {
      重做按钮.style.backgroundColor = '#444c56'
      重做按钮.style.borderColor = '#768390'
    }
    重做按钮.onmouseleave = (): void => {
      重做按钮.style.backgroundColor = '#2d333b'
      重做按钮.style.borderColor = '#444c56'
    }

    let 切换混音器按钮 = 创建元素('button', {
      textContent: '🎚️ 混音器',
      style: {
        padding: '8px 16px',
        backgroundColor: '#2d333b',
        color: '#adbac7',
        border: '1px solid #444c56',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.2s',
      },
    })
    切换混音器按钮.onmouseenter = (): void => {
      切换混音器按钮.style.backgroundColor = '#444c56'
      切换混音器按钮.style.borderColor = '#768390'
    }
    切换混音器按钮.onmouseleave = (): void => {
      切换混音器按钮.style.backgroundColor = '#2d333b'
      切换混音器按钮.style.borderColor = '#444c56'
    }

    let 导出按钮 = 创建元素('button', {
      textContent: '💾 导出 MP4',
      style: {
        padding: '8px 16px',
        backgroundColor: '#2563eb',
        color: '#fff',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.2s',
      },
    })
    导出按钮.onmouseenter = (): void => {
      导出按钮.style.backgroundColor = '#1d4ed8'
      导出按钮.style.borderColor = '#2563eb'
    }
    导出按钮.onmouseleave = (): void => {
      导出按钮.style.backgroundColor = '#2563eb'
      导出按钮.style.borderColor = '#3b82f6'
    }

    顶部控制栏.append(录制按钮, 撤销按钮, 重做按钮, 选择屏幕按钮, 切换混音器按钮, 导出按钮)

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

    let 混音器包装 = 创建元素('div', {
      style: {
        display: 'none', // 默认隐藏
      },
    })
    this.混音器组件 = new 视频混音器组件()
    混音器包装.append(this.混音器组件)

    底部容器.append(this.时间轴组件, 混音器包装)

    容器.append(顶部控制栏, 预览容器, 底部容器)
    this.shadow.append(容器)

    // UI 交互逻辑
    切换混音器按钮.onclick = (): void => {
      if (混音器包装.style.display === 'none') {
        混音器包装.style.display = 'block'
      } else {
        混音器包装.style.display = 'none'
      }
    }

    导出按钮.onclick = async (): Promise<void> => {
      if (this.切片列表.length === 0) {
        alert('没有可以导出的片段')
        return
      }
      导出按钮.textContent = '⏳ 正在导出...'
      try {
        await this.导出器.导出MP4(this.切片列表)
        alert('导出成功！')
      } catch (e) {
        console.error(e)
        alert('导出失败: ' + String(e))
      } finally {
        导出按钮.textContent = '💾 导出 MP4'
      }
    }

    撤销按钮.onclick = (): void => {
      this.执行撤销()
    }

    重做按钮.onclick = (): void => {
      this.执行重做()
    }

    选择屏幕按钮.onclick = async (): Promise<void> => {
      try {
        let stream: MediaStream
        if (window.electronAPI?.获取屏幕列表 !== undefined) {
          // Electron 环境
          let 屏幕ID = await this.弹出屏幕选择()
          if (屏幕ID === null || 屏幕ID === '') return

          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 屏幕ID },
            } as unknown as MediaTrackConstraints,
          })
        } else {
          // Web 环境
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
        选择屏幕按钮.textContent = '✅ 已选择屏幕'
        选择屏幕按钮.style.backgroundColor = '#059669'
      } catch (err) {
        console.error('获取屏幕失败', err)
      }
    }

    录制按钮.onclick = (): void => {
      // 如果正在录制，则停止
      if (this.录制器 !== null && this.录制器.state === 'recording') {
        this.录制器.stop()
        录制按钮.textContent = '🔴 开始录制'
        录制按钮.style.backgroundColor = '#dc2626'
        录制按钮.style.borderColor = '#ef4444'
        录制按钮.style.animation = 'none'
        录制按钮.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
        return
      }

      // 如果未录制，则开始
      if (this.当前媒体流 === null) {
        alert('请先选择屏幕！')
        return
      }

      this.保存历史()

      this.录制的数据块 = []

      // 穿插录制：获取当前时间轴的位置
      let 穿插起点时间 = this.时间轴组件?.获取当前时间() ?? 0

      // 截断波形或用0填充
      let 保留的波形长度 = Math.floor(穿插起点时间 * 100)
      if (this.实时波形数据.length > 保留的波形长度) {
        this.实时波形数据 = this.实时波形数据.slice(0, 保留的波形长度)
      } else {
        while (this.实时波形数据.length < 保留的波形长度) {
          this.实时波形数据.push(0)
        }
      }

      this.录制器 = new MediaRecorder(this.当前媒体流, { mimeType: 'video/webm' })

      // WebCodecs 实时编码准备
      void this.导出器.开始录制(this.当前媒体流)

      // 设置音频分析
      this.音频上下文 = new AudioContext()
      let source = this.音频上下文.createMediaStreamSource(this.当前媒体流)
      let 分析器 = this.音频上下文.createAnalyser()
      分析器.fftSize = 512
      source.connect(分析器)

      let 频率数据 = new Uint8Array(分析器.frequencyBinCount)
      this.录制开始时间 = performance.now()

      let 记录波形循环 = (): void => {
        if (this.录制器 !== null && this.录制器.state === 'recording') {
          let 本次录制经过时间 = (performance.now() - this.录制开始时间) / 1000
          let 当前绝对时间 = 穿插起点时间 + 本次录制经过时间

          // 使用时域数据计算均方根(RMS)来获得真实的音量感知
          分析器.getByteTimeDomainData(频率数据)
          let sumSquares = 0.0
          for (let i = 0; i < 频率数据.length; i++) {
            let normalized = ((频率数据[i] ?? 128) - 128) / 128
            sumSquares += normalized * normalized
          }
          let rms = Math.sqrt(sumSquares / 频率数据.length)
          // 放大一点并稍微做个非线性以便于视觉观察
          let val = Math.min(1.0, rms * 6)

          // 假设采样率是 100
          let 目标长度 = Math.floor(当前绝对时间 * 100)
          while (this.实时波形数据.length < 目标长度) {
            this.实时波形数据.push(val)
          }

          // false: 录制时不要重置缩放
          this.时间轴组件?.设置峰值数据(this.实时波形数据, 100, false)
          this.时间轴组件?.同步进度(当前绝对时间)

          this.录制循环ID = requestAnimationFrame(记录波形循环)
        }
      }

      this.录制器.ondataavailable = (e): void => {
        if (e.data.size > 0) this.录制的数据块.push(e.data)
      }

      this.录制器.onstop = (): void => {
        if (this.录制循环ID !== null) cancelAnimationFrame(this.录制循环ID)
        if (this.音频上下文 !== null) {
          void this.音频上下文.close()
          this.音频上下文 = null
        }

        let 编码结果 = this.导出器.停止录制()

        let blob = new Blob(this.录制的数据块, { type: 'video/webm' })
        let url = URL.createObjectURL(blob)

        let 录制结束时间 = this.实时波形数据.length / 100

        let 新片段: 视频片段 = { url: url, start: 穿插起点时间, duration: 录制结束时间 - 穿插起点时间 }
        if (编码结果.videoChunks !== undefined) 新片段.videoChunks = 编码结果.videoChunks
        if (编码结果.audioChunks !== undefined) 新片段.audioChunks = 编码结果.audioChunks
        if (编码结果.videoConfig !== undefined) 新片段.videoConfig = 编码结果.videoConfig
        if (编码结果.audioConfig !== undefined) 新片段.audioConfig = 编码结果.audioConfig

        let 新切片列表: 视频片段[] = []
        for (let 片段 of this.切片列表) {
          if (片段.start >= 穿插起点时间) {
            continue
          } else if (片段.start + 片段.duration > 穿插起点时间) {
            新切片列表.push({ ...片段, duration: 穿插起点时间 - 片段.start })
          } else {
            新切片列表.push(片段)
          }
        }
        新切片列表.push(新片段)
        this.切片列表 = 新切片列表

        this.预览组件?.设置播放列表(this.切片列表)

        this.时间轴组件?.设置峰值数据(this.实时波形数据, 100, false)

        setTimeout(() => {
          this.时间轴组件?.同步进度(录制结束时间)
          this.预览组件?.跳转(录制结束时间)
        }, 50)
      }

      this.录制器.start(100) // 100ms 吐一次切片
      this.录制循环ID = requestAnimationFrame(记录波形循环)

      录制按钮.textContent = '⏹ 停止录制'
      录制按钮.style.backgroundColor = '#4b5563'
      录制按钮.style.borderColor = '#6b7280'
      录制按钮.style.animation = 'pulse 1.5s infinite'
      录制按钮.style.boxShadow = 'none'
    }

    // 事件联动
    this.预览组件.监听发出事件('进度变化', async (e): Promise<void> => {
      this.时间轴组件?.同步进度(e.detail)
    })

    this.时间轴组件.监听发出事件('进度跳转', async (e): Promise<void> => {
      this.预览组件?.跳转(e.detail)
    })
  }
}
