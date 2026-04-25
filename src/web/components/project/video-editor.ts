import { 组件基类 } from '../../base/base'
import { 右键菜单管理器 } from '../../global/manager/context-menu-manager'
import { 创建元素 } from '../../global/tools/create-element'
import { 打开规则编辑模态框 } from './video-editor/video-editor-rule-modal'
import { 裁剪规则 } from './video-editor/video-editor-types'
import { 生成规则展示信息, 计算排除片段 } from './video-editor/video-editor-utils'
import { 视频预览组件 } from './video-editor/video-preview'
import { 视频时间轴组件 } from './video-editor/video-timeline'

type 发出事件类型 = {}
type 监听事件类型 = {}

export class 视频剪辑页面组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-editor', this)
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
        flexDirection: 'row',
        padding: '20px',
        boxSizing: 'border-box',
        background: '#121212',
        color: '#fff',
        fontFamily: "'Inter', sans-serif",
        gap: '20px',
      },
    })

    let 左侧主内容 = 创建元素('div', {
      style: {
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        minWidth: '0',
        minHeight: '0',
        overflow: 'hidden',
      },
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

    左侧主内容.append(预览容器, this.时间轴组件)

    // ---------------- 规则面板 ----------------
    let 右侧规则面板 = 创建元素('div', {
      style: {
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1e23',
        borderRadius: '16px',
        padding: '20px',
        gap: '16px',
        border: '1px solid #333',
      },
    })

    let 面板标题 = 创建元素('div', {
      textContent: '粗剪规则',
      style: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#e0e7ff',
        borderBottom: '1px solid #333',
        paddingBottom: '12px',
      },
    })

    let 规则列表容器 = 创建元素('div', {
      style: { flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' },
    })

    let 规则按钮容器 = 创建元素('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' },
    })

    let 添加静音规则按钮 = 创建元素('button', {
      textContent: '+ 添加裁剪规则',
      style: {
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        color: '#818cf8',
        border: '1px dashed #4f46e5',
        cursor: 'pointer',
        fontWeight: '500',
        transition: 'all 0.2s',
      },
    })
    添加静音规则按钮.onmouseenter = (): void => {
      添加静音规则按钮.style.backgroundColor = 'rgba(79, 70, 229, 0.2)'
    }
    添加静音规则按钮.onmouseleave = (): void => {
      添加静音规则按钮.style.backgroundColor = 'rgba(79, 70, 229, 0.1)'
    }

    规则按钮容器.append(添加静音规则按钮)
    右侧规则面板.append(面板标题, 规则列表容器, 规则按钮容器)

    let 当前规则列表: 裁剪规则[] = []
    let 当前排除片段: { start: number; end: number }[] = []

    let 渲染规则列表 = (): void => {
      规则列表容器.innerHTML = ''
      if (当前规则列表.length === 0) {
        规则列表容器.append(
          创建元素('div', {
            textContent: '暂无规则，播放时不会跳过任何片段。',
            style: { color: '#666', fontSize: '14px', textAlign: 'center', marginTop: '20px' },
          }),
        )
      } else {
        当前规则列表.forEach((规则, index) => {
          let { 描述, 标签列表 } = 生成规则展示信息(规则)

          let 规则项 = 创建元素('div', {
            style: {
              backgroundColor: '#1e242c',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #2d333b',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 0.2s',
              opacity: 规则.已禁用 === true ? '0.5' : '1',
              filter: 规则.已禁用 === true ? 'grayscale(0.8)' : 'none',
            },
          })

          规则项.oncontextmenu = (e): void => {
            e.preventDefault()
            右键菜单管理器.获得实例().显示菜单(e.clientX, e.clientY, [
              {
                文本: 规则.已禁用 === true ? '启用规则' : '禁用规则',
                回调: async (): Promise<void> => {
                  规则.已禁用 = 规则.已禁用 !== true
                  重新计算规则()
                },
              },
              '分隔符',
              {
                文本: '编辑规则',
                回调: async (): Promise<void> => {
                  await 打开规则编辑模态框(规则, (修改后的规则) => {
                    当前规则列表[index] = 修改后的规则
                    重新计算规则()
                  })
                },
              },
              {
                文本: '删除规则',
                回调: async (): Promise<void> => {
                  当前规则列表.splice(index, 1)
                  重新计算规则()
                },
              },
            ])
          }

          let 顶部行 = 创建元素('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
          })

          let 标签容器 = 创建元素('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', flex: '1' } })

          if (标签列表.length === 0) {
            标签容器.append(
              创建元素('span', {
                textContent: '全选',
                style: {
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#333',
                  color: '#aaa',
                },
              }),
            )
          } else {
            标签列表.forEach((text) => {
              标签容器.append(
                创建元素('span', {
                  textContent: text,
                  style: {
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(129, 140, 248, 0.15)',
                    color: '#818cf8',
                    border: '1px solid rgba(129, 140, 248, 0.2)',
                  },
                }),
              )
            })
          }

          let 操作组 = 创建元素('div', { style: { display: 'flex', gap: '4px' } })
          let 创建操作按钮 = (icon: string, color: string, onclick: () => void): HTMLButtonElement => {
            let btn = 创建元素('button', {
              textContent: icon,
              style: {
                background: 'none',
                border: 'none',
                color: color,
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              },
            })
            btn.onmouseenter = (): void => {
              btn.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
            }
            btn.onmouseleave = (): void => {
              btn.style.backgroundColor = 'transparent'
            }
            btn.onclick = onclick
            return btn
          }

          操作组.append(
            创建操作按钮('↑', '#fff', () => {
              if (index > 0) {
                let temp = 当前规则列表[index]
                if (temp === undefined) throw new Error('意外的空值')
                let prev = 当前规则列表[index - 1]
                if (prev === undefined) throw new Error('意外的空值')
                当前规则列表[index] = prev
                当前规则列表[index - 1] = temp
                重新计算规则()
              }
            }),
            创建操作按钮('↓', '#fff', () => {
              if (index < 当前规则列表.length - 1) {
                let temp = 当前规则列表[index]
                if (temp === undefined) throw new Error('意外的空值')
                let next = 当前规则列表[index + 1]
                if (next === undefined) throw new Error('意外的空值')
                当前规则列表[index] = next
                当前规则列表[index + 1] = temp
                重新计算规则()
              }
            }),
            创建操作按钮('✎', '#60a5fa', async () => {
              await 打开规则编辑模态框(规则, (修改后的规则) => {
                当前规则列表[index] = 修改后的规则
                重新计算规则()
              })
            }),
            创建操作按钮('✕', '#ef4444', () => {
              当前规则列表.splice(index, 1)
              重新计算规则()
            }),
          )

          顶部行.append(标签容器, 操作组)

          let 描述行 = 创建元素('div', {
            textContent: 描述,
            style: { color: '#9ca3af', fontSize: '12px', fontWeight: '500' },
          })

          规则项.append(顶部行, 描述行)
          规则列表容器.append(规则项)
        })
      }
    }

    let 重新计算规则 = (): void => {
      当前排除片段 = []
      let 时长 = this.预览组件?.获取视频时长() ?? 0
      let 峰值 = this.时间轴组件?.获取峰值数据()

      if (时长 <= 0 || 峰值 === null || 峰值 === undefined || 当前规则列表.length === 0) {
        this.预览组件?.设置排除片段([])
        this.时间轴组件?.设置排除片段([])
        渲染规则列表()
        return
      }

      let 样本率 = 100 // 当前后端使用100个采样点每秒
      当前排除片段 = 计算排除片段(时长, 峰值, 样本率, 当前规则列表)

      this.预览组件?.设置排除片段(当前排除片段)
      this.时间轴组件?.设置排除片段(当前排除片段)
      渲染规则列表()
    }

    // 打开规则编辑模态框已提取到外部

    添加静音规则按钮.onclick = async (): Promise<void> => {
      await 打开规则编辑模态框(undefined, (新规则) => {
        当前规则列表.push(新规则)
        重新计算规则()
      })
    }

    渲染规则列表()

    容器.append(左侧主内容, 右侧规则面板)
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
      if (文件 === undefined) throw new Error('意外的空值')
      if (文件.type.startsWith('video/')) {
        let url = URL.createObjectURL(文件)
        let 真实路径 = window.electronAPI.获取文件路径(文件)
        if (this.预览组件 !== null && this.预览组件.parentElement === null) {
          拖拽提示.remove()
          预览容器.append(this.预览组件)
        }
        this.预览组件?.设置视频源(url)
        await this.时间轴组件?.设置资源(url, 文件.name, 真实路径)
        重新计算规则()
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
