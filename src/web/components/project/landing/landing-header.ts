import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'

let 标志地址 = new URL('../../../../../public/punch-in-logo.svg', import.meta.url).toString()
let 工作室标志地址 = new URL('../../../../../public/kedaya-logo.svg', import.meta.url).toString()

type 发出事件类型 = Record<string, never>
type 监听事件类型 = Record<string, never>

export class 补录落地页头部组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-punch-in-landing-header', this)
  }

  protected override async 当加载时(): Promise<void> {
    let 样式 = 创建元素('style', {
      textContent: `
        .header { position: sticky; top: 0; z-index: 20; height: 72px; padding: 0 max(24px, calc((100vw - 1180px) / 2)); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.08); background: rgba(13,15,30,.72); backdrop-filter: blur(18px); box-sizing: border-box; }
        .brand-group { display: inline-flex; align-items: center; gap: 12px; min-width: 0; }
        .studio, .brand { display: inline-flex; align-items: center; color: #fff; text-decoration: none; }
        .studio { width: 32px; height: 32px; transition: transform .2s ease, filter .2s ease; }
        .studio img { width: 100%; height: 100%; object-fit: contain; }
        .studio:hover { transform: scale(1.08); filter: drop-shadow(0 0 8px rgba(168,85,247,.48)); }
        .separator { padding: 0 2px; color: rgba(255,255,255,.3); font-size: 18px; font-weight: 800; user-select: none; }
        .brand { gap: 10px; font-size: 19px; font-weight: 800; letter-spacing: -.02em; }
        .brand img { width: 34px; height: 34px; transition: transform .2s ease, filter .2s ease; }
        .brand span { display: block; color: #fff; line-height: 1; transition: color .2s ease; }
        .brand:hover img { transform: scale(1.05); filter: drop-shadow(0 0 8px rgba(101,225,211,.28)); }
        .brand:hover span { color: #e5e2ff; }
        .actions { display: flex; align-items: center; gap: 12px; }
        .github, .open { padding: 9px 16px; border-radius: 999px; color: #e9e9f7; text-decoration: none; font-size: 14px; transition: background .2s ease, transform .2s ease; }
        .github:hover { background: rgba(255,255,255,.08); }
        .open { color: #101123; background: #f4f2ff; font-weight: 800; }
        .open:hover { transform: translateY(-2px); }
        @media (max-width: 680px) { .studio, .separator { display: none; } }
        @media (max-width: 560px) { .header { height: 64px; padding: 0 16px; } .github { display: none; } }
      `,
    })
    let 工作室链接 = 创建元素('a', {
      className: 'studio',
      href: 'https://hbybyyang.cn/',
      target: '_blank',
      rel: 'noreferrer',
      title: '科达雅软件工作室',
      ariaLabel: '访问科达雅软件工作室主页',
    })
    工作室链接.append(创建元素('img', { src: 工作室标志地址, alt: '科达雅软件工作室' }))
    let 分隔符 = 创建元素('span', { className: 'separator', textContent: '×', ariaHidden: 'true' })
    let 标志 = 创建元素('a', { className: 'brand', href: './' })
    标志.append(创建元素('img', { src: 标志地址, alt: '补录录' }), 创建元素('span', { textContent: '补录录' }))
    let 品牌区 = 创建元素('div', { className: 'brand-group' })
    品牌区.append(工作室链接, 分隔符, 标志)
    let 操作区 = 创建元素('nav', { className: 'actions', ariaLabel: '主要导航' })
    操作区.append(
      创建元素('a', {
        className: 'github',
        href: 'https://github.com/lsby/punch-in',
        target: '_blank',
        rel: 'noreferrer',
        textContent: '查看源码',
      }),
      创建元素('a', { className: 'open', href: './app.html', textContent: '立即使用' }),
    )
    let 头部 = 创建元素('header', { className: 'header' })
    头部.append(品牌区, 操作区)
    this.shadow.append(样式, 头部)
  }
}
