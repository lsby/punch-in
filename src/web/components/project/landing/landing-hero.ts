import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'
import { 补录时间轴动画组件 } from './landing-demo'

type 发出事件类型 = { 查看演示: null }
type 监听事件类型 = Record<string, never>

export class 补录落地页英雄区组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-punch-in-landing-hero', this)
  }

  protected override async 当加载时(): Promise<void> {
    let 样式 = 创建元素('style', {
      textContent: `
        .hero { min-height: 650px; max-width: 1240px; margin: 0 auto; padding: 72px 28px 44px; display: grid; grid-template-columns: minmax(0, .9fr) minmax(480px, 1.1fr); gap: 54px; align-items: center; box-sizing: border-box; }
        .copy { position: relative; z-index: 1; }
        .badge { display: inline-flex; padding: 7px 12px; color: #9e93ff; border: 1px solid rgba(145,124,255,.28); border-radius: 999px; background: rgba(116,87,255,.1); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
        h1 { margin: 24px 0; font-size: clamp(48px, 5.5vw, 70px); line-height: .98; letter-spacing: -.065em; }
        h1 span { display: block; color: transparent; background: linear-gradient(100deg, #9f8fff, #5ce4d5 72%); background-clip: text; }
        .description { max-width: 590px; margin: 0; color: #aeb2c9; font-size: 17px; line-height: 1.75; }
        .buttons { margin-top: 34px; display: flex; flex-wrap: wrap; gap: 12px; }
        .primary, .secondary { padding: 13px 22px; border-radius: 999px; font: 800 15px inherit; cursor: pointer; text-decoration: none; }
        .primary { color: #101123; background: #f4f2ff; border-color: transparent; }
        .secondary { color: #e8e8f3; background: transparent; border-color: rgba(255,255,255,.17); }
        .primary:hover, .secondary:hover { transform: translateY(-2px); }
        .privacy { margin-top: 22px; color: #777d98; font-size: 12px; letter-spacing: .03em; }
        @media (max-width: 960px) { .hero { grid-template-columns: 1fr; padding-top: 64px; } }
        @media (max-width: 560px) { .hero { min-height: auto; padding: 54px 18px 30px; gap: 42px; } h1 { font-size: 50px; } .description { font-size: 15px; } }
      `,
    })
    let 文案 = 创建元素('div', { className: 'copy' })
    let 标题 = 创建元素('h1')
    标题.append('说错的那几秒，', 创建元素('span', { textContent: '录对就好。' }))
    let 按钮区 = 创建元素('div', { className: 'buttons' })
    let 演示按钮 = 创建元素('button', { className: 'secondary', textContent: '看看它怎么工作' })
    演示按钮.onclick = (): void => {
      this.派发事件('查看演示', null)
    }
    按钮区.append(创建元素('a', { className: 'primary', href: './app.html', textContent: '在浏览器中打开' }), 演示按钮)
    文案.append(
      创建元素('span', { className: 'badge', textContent: '本地运行的屏幕补录工具' }),
      标题,
      创建元素('p', {
        className: 'description',
        textContent: '不再因为一句口误重录整段视频。定位到时间轴、原位补录、用规则清掉停顿，然后直接导出原画 MP4。',
      }),
      按钮区,
      创建元素('p', { className: 'privacy', textContent: '纯前端运行 · 素材不上传 · 数据保存在当前浏览器' }),
    )
    let 动画 = new 补录时间轴动画组件()
    动画.setAttribute('精简', 'true')
    let 区域 = 创建元素('section', { className: 'hero' })
    区域.append(文案, 动画)
    this.shadow.append(样式, 区域)
  }
}
