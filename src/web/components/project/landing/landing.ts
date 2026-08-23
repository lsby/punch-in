import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'
import { 补录落地页演示组件 } from './landing-demo'
import { 补录落地页页脚组件 } from './landing-footer'
import { 补录落地页头部组件 } from './landing-header'
import { 补录落地页英雄区组件 } from './landing-hero'

type 发出事件类型 = Record<string, never>
type 监听事件类型 = Record<string, never>

export class 补录落地页组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-punch-in-landing', this)
  }

  protected override async 当加载时(): Promise<void> {
    let 容器 = 创建元素('main', {
      style: {
        width: '100%',
        height: '100vh',
        overflowX: 'hidden',
        overflowY: 'auto',
        color: '#f7f7ff',
        background: 'radial-gradient(circle at 70% 8%, #252452 0, #121326 34%, #0d0f1e 70%)',
        fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        scrollBehavior: 'smooth',
      },
    })
    let 头部 = new 补录落地页头部组件()
    let 英雄区 = new 补录落地页英雄区组件()
    let 演示区 = new 补录落地页演示组件()
    英雄区.监听发出事件('查看演示', async (): Promise<void> => {
      演示区.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    容器.append(头部, 英雄区, this.创建特性区(), 演示区, this.创建行动区(), new 补录落地页页脚组件())
    this.shadow.append(容器)
  }

  private 创建特性区(): HTMLElement {
    let 特性 = [
      { 编号: '01', 标题: '原位补录', 描述: '把播放头停在需要修改的位置，重新录制后自动接回时间轴，不必整段重来。' },
      { 编号: '02', 标题: '声音一起处理', 描述: '系统音频与麦克风分别控制、实时混音，并用波形快速找到停顿和杂音。' },
      { 编号: '03', 标题: '规则化剪辑', 描述: '按时间或声音条件排除片段，预览时即时生效，让重复修改变成可复用规则。' },
      { 编号: '04', 标题: '原画 MP4 导出', 描述: '尽量直接封装原始音视频，避免不必要的二次编码，兼顾速度与画质。' },
    ]
    let 网格 = 创建元素('div', { className: 'feature-grid' })
    for (let 项 of 特性) {
      let 卡片 = 创建元素('article', { className: 'feature-card' })
      let 编号 = 创建元素('span', { className: 'feature-number', textContent: 项.编号 })
      let 标题 = 创建元素('h3', { textContent: 项.标题 })
      let 描述 = 创建元素('p', { textContent: 项.描述 })
      卡片.append(编号, 标题, 描述)
      卡片.onmouseenter = (): void => {
        卡片.style.transform = 'translateY(-8px)'
        卡片.style.borderColor = 'rgba(127, 105, 255, .7)'
      }
      卡片.onmouseleave = (): void => {
        卡片.style.transform = 'translateY(0)'
        卡片.style.borderColor = 'rgba(255, 255, 255, .1)'
      }
      网格.append(卡片)
    }
    let 区域 = 创建元素('section', { className: 'feature-section' })
    区域.append(
      创建元素('p', { className: 'eyebrow', textContent: '从录制到交付' }),
      创建元素('h2', { textContent: '只重做需要重做的部分' }),
      网格,
    )
    let 样式 = 创建元素('style', {
      textContent: `
        .feature-section { max-width: 1180px; margin: 0 auto; padding: 96px 28px; box-sizing: border-box; }
        .feature-section > h2 { margin: 8px 0 36px; font-size: clamp(30px, 5vw, 52px); letter-spacing: -.04em; }
        .eyebrow { color: #65e1d3; margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .18em; }
        .feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .feature-card { min-height: 210px; padding: 26px; border-radius: 22px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.045); transition: transform .25s ease, border-color .25s ease; box-sizing: border-box; }
        .feature-number { color: #8f7cff; font: 700 13px monospace; }
        .feature-card h3 { margin: 44px 0 12px; font-size: 21px; }
        .feature-card p { margin: 0; color: #aeb2c9; line-height: 1.75; font-size: 14px; }
        @media (max-width: 900px) { .feature-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .feature-section { padding: 70px 18px; } .feature-grid { grid-template-columns: 1fr; } .feature-card { min-height: 180px; } }
      `,
    })
    let 包装 = 创建元素('div')
    包装.append(样式, 区域)
    return 包装
  }

  private 创建行动区(): HTMLElement {
    let 链接 = 创建元素('a', { className: 'cta-button', href: './app.html', textContent: '打开补录录' })
    let 区域 = 创建元素('section', { className: 'cta-section' })
    区域.append(
      创建元素('p', { textContent: '所有处理都在你的浏览器本机完成' }),
      创建元素('h2', { textContent: '下一次说错，不用从头再来。' }),
      链接,
    )
    let 样式 = 创建元素('style', {
      textContent: `
        .cta-section { margin: 90px auto; width: min(1120px, calc(100% - 36px)); padding: 72px 24px; text-align: center; border: 1px solid rgba(255,255,255,.12); border-radius: 30px; background: linear-gradient(135deg, rgba(112,84,255,.2), rgba(30,202,184,.12)); box-sizing: border-box; }
        .cta-section p { margin: 0 0 12px; color: #65e1d3; }
        .cta-section h2 { margin: 0 auto 32px; max-width: 760px; font-size: clamp(30px, 5vw, 58px); letter-spacing: -.045em; }
        .cta-button { display: inline-flex; padding: 14px 25px; color: #101123; background: #f4f2ff; border-radius: 999px; text-decoration: none; font-weight: 800; transition: transform .2s ease, box-shadow .2s ease; }
        .cta-button:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(116,87,255,.32); }
      `,
    })
    let 包装 = 创建元素('div')
    包装.append(样式, 区域)
    return 包装
  }
}
