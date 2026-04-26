import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'

type 发出事件类型 = {
  音量改变: { 类型: '桌面' | '麦克风'; 音量: number }
  静音状态改变: { 类型: '桌面' | '麦克风'; 是否静音: boolean }
}
type 监听事件类型 = {}

export class 视频混音器组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-video-audio-mixer', this)
  }

  private 桌面音频音量 = 1.0
  private 桌面音频静音 = false
  private 桌面音频电平条: HTMLElement | null = null

  private 麦克风音量 = 1.0
  private 麦克风静音 = false
  private 麦克风电平条: HTMLElement | null = null

  protected override async 当加载时(): Promise<void> {
    this.获得宿主样式().display = 'flex'
    this.获得宿主样式().flexDirection = 'column'
    this.获得宿主样式().width = '100%'
    this.获得宿主样式().backgroundColor = '#252932'
    this.获得宿主样式().borderRadius = '8px'
    this.获得宿主样式().overflow = 'hidden'
    this.获得宿主样式().border = '1px solid #3b4252'

    let 标题栏 = 创建元素('div', {
      textContent: '混音器',
      style: {
        padding: '8px 12px',
        backgroundColor: '#1e222a',
        color: '#e5e9f0',
        fontSize: '14px',
        fontWeight: 'bold',
        borderBottom: '1px solid #3b4252',
      },
    })

    let 桌面音频轨道 = this.创建轨道('桌面音频', '桌面')
    this.桌面音频电平条 = 桌面音频轨道.电平条内部
    let 分隔线 = 创建元素('div', { style: { height: '1px', backgroundColor: '#3b4252', margin: '0 12px' } })
    let 麦克风轨道 = this.创建轨道('麦克风/Aux', '麦克风')
    this.麦克风电平条 = 麦克风轨道.电平条内部

    this.shadow.append(标题栏, 桌面音频轨道.容器, 分隔线, 麦克风轨道.容器)

    // 模拟一下电平跳动，测试UI
    setInterval(() => {
      if (this.桌面音频电平条 !== null) {
        if (!this.桌面音频静音) {
          let 随机值 = Math.random() * 100 * this.桌面音频音量
          this.更新电平(this.桌面音频电平条, 随机值)
        } else {
          this.更新电平(this.桌面音频电平条, 0)
        }
      }

      if (this.麦克风电平条 !== null) {
        if (!this.麦克风静音) {
          let 随机值 = Math.random() * 100 * this.麦克风音量
          this.更新电平(this.麦克风电平条, 随机值)
        } else {
          this.更新电平(this.麦克风电平条, 0)
        }
      }
    }, 50)
  }

  private 创建轨道(名称: string, 类型: '桌面' | '麦克风'): { 容器: HTMLElement; 电平条内部: HTMLElement } {
    let 容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', padding: '12px', gap: '8px' } })

    let 顶部行 = 创建元素('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } })

    let 轨道名称 = 创建元素('div', { textContent: 名称, style: { color: '#d8dee9', fontSize: '13px' } })

    let 右侧控制 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })

    let db显示 = 创建元素('div', {
      textContent: '0.0 dB',
      style: { color: '#8fbcbb', fontSize: '13px', width: '50px', textAlign: 'right' },
    })

    右侧控制.append(db显示)
    顶部行.append(轨道名称, 右侧控制)

    let 中间行 = 创建元素('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } })

    let 静音按钮 = 创建元素('button', {
      textContent: '🔊',
      style: {
        background: 'none',
        border: 'none',
        color: '#d8dee9',
        cursor: 'pointer',
        fontSize: '16px',
        width: '24px',
        display: 'flex',
        justifyContent: 'center',
      },
    })

    let 滑块容器 = 创建元素('div', { style: { flex: '1', display: 'flex', alignItems: 'center' } })

    let 音量滑块 = 创建元素('input', { style: { width: '100%', cursor: 'pointer' } })
    音量滑块.type = 'range'
    音量滑块.min = '0'
    音量滑块.max = '1'
    音量滑块.step = '0.01'
    音量滑块.value = '1'

    音量滑块.oninput = (): void => {
      let 音量 = parseFloat(音量滑块.value)
      if (类型 === '桌面') this.桌面音频音量 = 音量
      if (类型 === '麦克风') this.麦克风音量 = 音量
      this.派发事件('音量改变', { 类型, 音量 })

      let db = 20 * Math.log10(音量)
      if (音量 === 0) db = -60
      db显示.textContent = db.toFixed(1) + ' dB'
    }

    静音按钮.onclick = (): void => {
      let 当前静音 = 类型 === '桌面' ? this.桌面音频静音 : this.麦克风静音
      let 新状态 = !当前静音
      if (类型 === '桌面') this.桌面音频静音 = 新状态
      if (类型 === '麦克风') this.麦克风静音 = 新状态
      静音按钮.textContent = 新状态 ? '🔇' : '🔊'
      静音按钮.style.opacity = 新状态 ? '0.5' : '1'
      this.派发事件('静音状态改变', { 类型, 是否静音: 新状态 })
    }

    滑块容器.append(音量滑块)
    中间行.append(静音按钮, 滑块容器)

    let 底部行 = 创建元素('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingLeft: '36px', // 对齐静音按钮后面
      },
    })

    let 电平条外框 = 创建元素('div', {
      style: {
        flex: '1',
        height: '10px',
        backgroundColor: '#1e222a',
        borderRadius: '2px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
      },
    })

    let 电平条内部 = 创建元素('div', {
      style: {
        width: '0%',
        height: '100%',
        background:
          'linear-gradient(90deg, #a3be8c 0%, #a3be8c 70%, #ebcb8b 70%, #ebcb8b 90%, #bf616a 90%, #bf616a 100%)',
        transition: 'width 0.05s ease-out',
        transformOrigin: 'left',
      },
    })

    let 刻度容器 = 创建元素('div', {
      style: {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        pointerEvents: 'none',
      },
    })

    // 简易刻度线
    for (let i = 0; i < 6; i++) {
      刻度容器.append(创建元素('div', { style: { width: '1px', backgroundColor: 'rgba(0,0,0,0.3)' } }))
    }

    电平条外框.append(电平条内部, 刻度容器)
    底部行.append(电平条外框)

    容器.append(顶部行, 中间行, 底部行)

    return { 容器, 电平条内部 }
  }

  private 更新电平(元素: HTMLElement | null, 百分比: number): void {
    if (元素 === null) return
    元素.style.width = `${Math.min(100, Math.max(0, 百分比))}%`
  }
}
