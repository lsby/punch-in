import { 组件基类 } from '../../base/base'
import { 创建元素 } from '../../global/tools/create-element'
import { 视频预览组件 } from './video-editor/video-preview'
import { 视频时间轴组件 } from './video-editor/video-timeline'

type 发出事件类型 = {}
type 监听事件类型 = {}

export class 视频剪辑页面组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-page-video-editor', this)
  }

  private 预览组件: 视频预览组件 | null = null
  private 时间轴组件: 视频时间轴组件 | null = null

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
      },
    })

    let 主内容 = 创建元素('div', {
      style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '0', overflow: 'hidden' },
    })

    this.预览组件 = new 视频预览组件()
    this.时间轴组件 = new 视频时间轴组件()
    this.时间轴组件.style.height = '280px'
    this.时间轴组件.style.flexShrink = '0'

    let 拖拽提示 = 创建元素('div', {
      textContent: '拖入视频文件开始预览',
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed #333',
        borderRadius: '16px',
        color: '#666',
        fontSize: '18px',
        transition: 'all 0.3s',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
      },
    })

    let 预览容器 = 创建元素('div', {
      style: { flex: '1', position: 'relative', minHeight: '0', display: 'flex', flexDirection: 'column' },
    })
    预览容器.append(拖拽提示)

    主内容.append(预览容器, this.时间轴组件)
    容器.append(主内容)
    this.shadow.append(容器)

    // 拖拽事件
    容器.ondragover = (e: DragEvent): void => {
      e.preventDefault()
      拖拽提示.style.borderColor = '#4f46e5'
      拖拽提示.style.color = '#4f46e5'
      拖拽提示.style.backgroundColor = 'rgba(79, 70, 229, 0.05)'
    }

    容器.ondragleave = (): void => {
      拖拽提示.style.borderColor = '#333'
      拖拽提示.style.color = '#666'
      拖拽提示.style.backgroundColor = 'transparent'
    }

    容器.ondrop = async (e: DragEvent): Promise<void> => {
      e.preventDefault()
      let 文件 = e.dataTransfer?.files[0]
      if (文件 !== undefined && 文件.type.startsWith('video/')) {
        let url = URL.createObjectURL(文件)
        let 真实路径 = window.electronAPI.获取文件路径(文件)
        if (this.预览组件 !== null && this.预览组件.parentElement === null) {
          拖拽提示.remove()
          预览容器.append(this.预览组件)
        }
        this.预览组件?.设置视频源(url)
        await this.时间轴组件?.设置资源(url, 文件.name, 真实路径)
      }
    }

    // 事件联动
    this.预览组件.监听发出事件('进度变化', async (e) => {
      this.时间轴组件?.同步进度(e.detail)
    })

    this.时间轴组件.监听发出事件('进度跳转', async (e) => {
      this.预览组件?.跳转(e.detail)
    })
  }
}
