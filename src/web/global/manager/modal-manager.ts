type 模态框选项 = {
  标题: string
  最大化?: boolean
  可关闭?: boolean
  关闭回调?: () => void | Promise<void>
  宽度?: string
  高度?: string
  最大高度?: string
}

type 模态框栈项 = {
  选项: 模态框选项
  内容: HTMLElement
  框: HTMLDivElement
  遮罩: HTMLDivElement
  内容容器: HTMLDivElement
  是否最大化: boolean
  当前宽度: string
  当前高度: string
  最大化按钮: 文本按钮
  初始位置?: { x: number; y: number }
}

import { 文本按钮 } from '../../components/general/base/base-button'
import { 创建元素 } from '../tools/create-element'

class 模态框管理器 {
  private 模态框栈: 模态框栈项[] = []
  private 头部高度 = 32
  private 键盘处理器: ((e: KeyboardEvent) => void) | null = null

  private 创建模态框框架(): {
    遮罩: HTMLDivElement
    框: HTMLDivElement
    头部: HTMLDivElement
    内容: HTMLDivElement
    最大化按钮: 文本按钮
    关闭按钮: 文本按钮
    标题元素: HTMLSpanElement
  } {
    // 遮罩
    let 遮罩 = 创建元素('div', {
      style: {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'none',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: (9999 + this.模态框栈.length).toString(),
      },
    })

    // 框
    let 框 = 创建元素('div', {
      style: {
        position: 'relative',
        background: '#1e2227',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      },
    })

    // 头部
    let 头部 = 创建元素('div', {
      style: {
        height: `${this.头部高度}px`,
        background: 'rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        justifyContent: 'space-between',
        userSelect: 'none',
        cursor: 'move',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      },
    })

    let 标题元素 = 创建元素('span', { style: { color: '#e5e7eb', fontSize: '14px', fontWeight: '600' } })
    头部.appendChild(标题元素)

    // 右侧按钮容器
    let 右侧按钮容器 = 创建元素('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } })

    // 最大化按钮
    let 最大化按钮 = new 文本按钮({
      文本: '□',
      元素样式: {
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '14px',
        color: '#9ca3af',
        padding: '4px',
        borderRadius: '4px',
      },
      标题: '最大化',
      点击处理函数: (): void => {
        this.切换最大化(this.模态框栈.length - 1)
      },
    })
    右侧按钮容器.appendChild(最大化按钮)

    // 关闭按钮
    let 关闭按钮 = new 文本按钮({
      文本: '✕',
      元素样式: {
        padding: '4px',
        fontSize: '14px',
        color: '#ef4444',
        fontWeight: 'bold',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: '4px',
      },
      点击处理函数: async (): Promise<void> => {
        await this.关闭()
      },
    })
    右侧按钮容器.appendChild(关闭按钮)

    头部.appendChild(右侧按钮容器)

    // 内容
    let 内容 = 创建元素('div', { style: { flex: '1', overflow: 'auto' } })

    框.appendChild(头部)
    框.appendChild(内容)
    遮罩.appendChild(框)

    // 拖拽逻辑
    let 拖拽中 = false
    let 偏移X = 0
    let 偏移Y = 0

    头部.onmousedown = (e: MouseEvent): void => {
      let 栈索引 = this.模态框栈.findIndex((项) => 项.框 === 框)
      let 栈项 = this.模态框栈[栈索引]
      if (栈索引 === -1 || 栈项 === undefined || 栈项.是否最大化) return

      拖拽中 = true
      let 矩形 = 框.getBoundingClientRect()
      偏移X = e.clientX - 矩形.left
      偏移Y = e.clientY - 矩形.top

      // 立即设置位置，防止闪烁
      框.style.transition = 'none'
      框.style.position = 'absolute'
      框.style.left = `${矩形.left}px`
      框.style.top = `${矩形.top}px`
      框.style.margin = '0'
      框.style.transform = 'none'

      遮罩.style.justifyContent = 'flex-start'
      遮罩.style.alignItems = 'flex-start'

      let 移动处理 = (me: MouseEvent): void => {
        if (!拖拽中) return
        框.style.left = `${me.clientX - 偏移X}px`
        框.style.top = `${me.clientY - 偏移Y}px`
      }

      let 停止处理 = (): void => {
        拖拽中 = false
        window.removeEventListener('mousemove', 移动处理)
        window.removeEventListener('mouseup', 停止处理)
      }

      window.addEventListener('mousemove', 移动处理)
      window.addEventListener('mouseup', 停止处理)
    }

    return { 遮罩, 框, 头部, 内容, 最大化按钮, 关闭按钮, 标题元素 }
  }

  private 切换最大化(栈索引: number): void {
    let 栈项 = this.模态框栈[栈索引]
    if (栈项 === undefined) return

    栈项.是否最大化 = 栈项.是否最大化 === false

    let { 框, 内容容器, 遮罩, 最大化按钮, 选项 } = 栈项

    if (栈项.是否最大化 === true) {
      框.style.width = '100vw'
      框.style.height = '100vh'
      框.style.maxHeight = 'none'
      框.style.left = '0'
      框.style.top = '0'
      框.style.transform = 'none'
      框.style.borderRadius = '0'
      遮罩.style.justifyContent = 'flex-start'
      遮罩.style.alignItems = 'flex-start'
      内容容器.style.width = '100%'
      内容容器.style.height = `calc(100vh - ${this.头部高度}px)`
      内容容器.style.maxHeight = 'none'
      最大化按钮.设置文本('🗗')
      最大化按钮.设置标题('还原')
    } else {
      框.style.width = 栈项.当前宽度
      框.style.height = 栈项.当前高度
      框.style.maxHeight = 选项.最大高度 ?? 'none'
      框.style.left = ''
      框.style.top = ''
      框.style.position = 'relative'
      框.style.transform = ''
      框.style.borderRadius = '12px'
      遮罩.style.justifyContent = 'center'
      遮罩.style.alignItems = 'center'
      内容容器.style.width = '100%'
      内容容器.style.height = 栈项.当前高度 === 'auto' ? 'auto' : '100%'
      内容容器.style.maxHeight = 选项.最大高度 !== undefined ? `calc(${选项.最大高度} - ${this.头部高度}px)` : 'none'
      最大化按钮.设置文本('□')
      最大化按钮.设置标题('最大化')
    }
  }

  public async 显示(选项: 模态框选项, 内容: HTMLElement): Promise<void> {
    let { 遮罩, 框, 内容: 内容容器, 标题元素, 关闭按钮, 最大化按钮 } = this.创建模态框框架()

    // 设置标题
    标题元素.textContent = 选项.标题

    // 设置是否可关闭
    if (选项.可关闭 === false) {
      关闭按钮.获得宿主样式().display = 'none'
    } else {
      关闭按钮.获得宿主样式().display = ''
    }

    // 设置内容
    内容容器.appendChild(内容)

    let 当前宽度 = 选项.宽度 ?? '60vw'
    let 当前高度 = 选项.高度 ?? '60vh'

    // 创建栈项
    let 栈项: 模态框栈项 = {
      选项,
      内容,
      框,
      遮罩,
      内容容器,
      是否最大化: 选项.最大化 ?? false,
      当前宽度,
      当前高度,
      最大化按钮,
    }

    // 添加到栈
    this.模态框栈.push(栈项)

    // 设置是否最大化
    if (选项.最大化 === true) {
      框.style.width = '100vw'
      框.style.height = '100vh'
      框.style.left = '0'
      框.style.top = '0'
      框.style.transform = 'none'
      框.style.borderRadius = '0'
      遮罩.style.justifyContent = 'flex-start'
      遮罩.style.alignItems = 'flex-start'
      内容容器.style.width = '100%'
      内容容器.style.height = `calc(100vh - ${this.头部高度}px)`
      最大化按钮.设置文本('🗗')
      最大化按钮.设置标题('还原')
    } else {
      框.style.width = 当前宽度
      框.style.height = 当前高度
      if (选项.最大高度 !== undefined) 框.style.maxHeight = 选项.最大高度
      框.style.left = ''
      框.style.top = ''
      框.style.transform = ''
      遮罩.style.justifyContent = 'center'
      遮罩.style.alignItems = 'center'
      内容容器.style.width = '100%'
      内容容器.style.height = 当前高度 === 'auto' ? 'auto' : '100%'
      内容容器.style.maxHeight = 选项.最大高度 !== undefined ? `calc(${选项.最大高度} - ${this.头部高度}px)` : 'none'
      最大化按钮.设置文本('□')
      最大化按钮.设置标题('最大化')
    }

    // 将遮罩添加到DOM
    document.body.appendChild(遮罩)

    // 显示遮罩
    遮罩.style.display = 'flex'

    // 如果是第一个模态框，绑定键盘事件
    if (this.模态框栈.length === 1) {
      this.键盘处理器 = async (e: KeyboardEvent): Promise<void> => {
        let 当前模态框 = this.模态框栈[this.模态框栈.length - 1]
        if (当前模态框 !== undefined && e.key === 'Escape' && 当前模态框.选项.可关闭 !== false) {
          await this.关闭()
        }
      }
      document.onkeydown = this.键盘处理器
    }
  }

  public async 关闭(): Promise<void> {
    if (this.模态框栈.length === 0) {
      return
    }

    let 栈项 = this.模态框栈.pop()
    if (栈项 === undefined) return

    // 执行关闭回调
    if (栈项.选项.关闭回调 !== undefined) {
      await 栈项.选项.关闭回调()
    }

    // 从DOM中移除遮罩
    if (栈项.遮罩.parentNode !== null) {
      栈项.遮罩.parentNode.removeChild(栈项.遮罩)
    }

    // 如果栈为空，移除键盘事件
    if (this.模态框栈.length === 0 && this.键盘处理器 !== null) {
      document.onkeydown = null
      this.键盘处理器 = null
    }
  }

  public 是否显示(): boolean {
    return this.模态框栈.length > 0
  }
}

// 单例实例
let 模态框单例: 模态框管理器 | null = null

function 获取模态框实例(): 模态框管理器 {
  if (模态框单例 === null) {
    模态框单例 = new 模态框管理器()
  }
  return 模态框单例
}

export function 显示模态框(选项: 模态框选项, 内容: HTMLElement): Promise<void> {
  let 实例 = 获取模态框实例()
  return 实例.显示(选项, 内容)
}

export function 关闭模态框(): Promise<void> {
  let 实例 = 获取模态框实例()
  return 实例.关闭()
}

export function 模态框是否显示(): boolean {
  let 实例 = 获取模态框实例()
  return 实例.是否显示()
}
