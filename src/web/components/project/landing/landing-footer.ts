import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'

let 公安备案图标 = new URL('../../../../../public/police-badge.svg', import.meta.url).toString()

type 发出事件类型 = Record<string, never>
type 监听事件类型 = Record<string, never>

export class 补录落地页页脚组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-punch-in-landing-footer', this)
  }

  protected override async 当加载时(): Promise<void> {
    let 样式 = 创建元素('style', {
      textContent: `
        footer { padding: 34px max(20px, calc((100vw - 1180px) / 2)); display: flex; justify-content: space-between; align-items: center; gap: 20px; color: #777d98; border-top: 1px solid rgba(255,255,255,.08); font-size: 12px; box-sizing: border-box; }
        .records { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 16px; }
        a { color: inherit; text-decoration: none; transition: color .2s ease; }
        a:hover { color: #b8afff; }
        .police { display: inline-flex; align-items: center; gap: 5px; }
        .police img { width: 16px; height: 16px; }
        @media (max-width: 720px) { footer { flex-direction: column; text-align: center; } .records { justify-content: center; } }
      `,
    })
    let 备案区 = 创建元素('div', { className: 'records' })
    let 公安链接 = 创建元素('a', {
      className: 'police',
      href: 'https://beian.mps.gov.cn/#/query/webSearch?code=65010402002238',
      target: '_blank',
      rel: 'noreferrer',
    })
    公安链接.append(
      创建元素('img', { src: 公安备案图标, alt: '' }),
      创建元素('span', { textContent: '新公网安备65010402002238号' }),
    )
    备案区.append(
      创建元素('a', {
        href: 'https://beian.miit.gov.cn/',
        target: '_blank',
        rel: 'noreferrer',
        textContent: '新ICP备2026003876号-1',
      }),
      公安链接,
    )
    let 页脚 = 创建元素('footer')
    页脚.append(创建元素('span', { textContent: '© 2026 科达雅软件工作室' }), 备案区)
    this.shadow.append(样式, 页脚)
  }
}
