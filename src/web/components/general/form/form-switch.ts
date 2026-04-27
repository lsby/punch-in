import { 增强样式类型 } from 'src/web/global/types/style'
import { 创建元素, 应用宿主样式 } from '../../../global/tools/create-element'
import { 表单组件基类 } from './form'

type 切换开关事件 = { 变化: boolean }
type 监听切换开关事件 = {}

type 切换开关配置 = {
  标签?: string
  值?: boolean
  禁用?: boolean
  变化处理函数?: (值: boolean) => void | Promise<void>
  宿主样式?: 增强样式类型
  元素样式?: 增强样式类型
}

class 切换开关 extends 表单组件基类<切换开关事件, 监听切换开关事件, boolean> {
  protected 配置: 切换开关配置
  private 核心元素?: HTMLDivElement
  private 滑块元素?: HTMLDivElement
  private 当前值: boolean = false

  public constructor(配置: 切换开关配置 = {}) {
    super()
    this.配置 = 配置
    this.当前值 = 配置.值 ?? false
  }

  protected async 当加载时(): Promise<void> {
    应用宿主样式(this.获得宿主样式(), this.配置.宿主样式)

    let 容器 = 创建元素('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: this.配置.禁用 === true ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        ...this.配置.元素样式,
      },
    })

    if (this.配置.标签 !== undefined) {
      let 标签元素 = 创建元素('span', {
        textContent: this.配置.标签,
        style: { fontSize: '14px', color: '#e5e7eb', fontWeight: '500' },
      })
      容器.appendChild(标签元素)
    }

    let 开关轨道 = 创建元素('div', {
      style: {
        width: '44px',
        height: '24px',
        backgroundColor: this.当前值 ? '#4f46e5' : '#374151',
        borderRadius: '12px',
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: '0',
        border: '1px solid ' + (this.当前值 ? '#6366f1' : '#4b5563'),
        boxShadow: this.当前值 ? '0 0 10px rgba(79, 70, 229, 0.3)' : 'none',
      },
    })

    let 滑块 = 创建元素('div', {
      style: {
        width: '18px',
        height: '18px',
        backgroundColor: '#fff',
        borderRadius: '50%',
        position: 'absolute',
        top: '2px',
        left: this.当前值 ? '22px' : '2px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      },
    })

    开关轨道.appendChild(滑块)
    容器.appendChild(开关轨道)

    容器.onclick = async (): Promise<void> => {
      if (this.配置.禁用 === true) return
      this.当前值 = !this.当前值
      this.更新视觉()

      // 添加点击微动动画
      开关轨道.style.transform = 'scale(0.95)'
      setTimeout(() => {
        开关轨道.style.transform = 'scale(1)'
      }, 100)

      await this.配置.变化处理函数?.(this.当前值)
      this.派发事件('变化', this.当前值)
    }

    容器.onmouseenter = (): void => {
      if (this.配置.禁用 === true) return
      开关轨道.style.filter = 'brightness(1.1)'
    }

    容器.onmouseleave = (): void => {
      开关轨道.style.filter = 'none'
    }

    this.shadow.appendChild(容器)
    this.核心元素 = 开关轨道
    this.滑块元素 = 滑块
  }

  private 更新视觉(): void {
    if (this.核心元素 === undefined || this.滑块元素 === undefined) return

    this.核心元素.style.backgroundColor = this.当前值 ? '#4f46e5' : '#374151'
    this.核心元素.style.borderColor = this.当前值 ? '#6366f1' : '#4b5563'
    this.核心元素.style.boxShadow = this.当前值 ? '0 0 10px rgba(79, 70, 229, 0.3)' : 'none'
    this.滑块元素.style.left = this.当前值 ? '22px' : '2px'
  }

  public 设置值(值: boolean): void {
    this.当前值 = 值
    this.更新视觉()
  }

  public 获得值(): boolean {
    return this.当前值
  }

  public 设置禁用(值: boolean): void {
    this.配置.禁用 = 值
    this.获得宿主样式().cursor = 值 ? 'not-allowed' : 'pointer'
  }
}

切换开关.注册组件('lsby-form-switch', 切换开关)

export { 切换开关 }
