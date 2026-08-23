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
    容器.append(
      头部,
      英雄区,
      this.创建问题区(),
      this.创建特性区(),
      this.创建工作流区(),
      演示区,
      this.创建场景区(),
      this.创建行动区(),
      new 补录落地页页脚组件(),
    )
    this.shadow.append(容器)
  }

  private 创建问题区(): HTMLElement {
    let 问题列表 = [
      { 标题: '从头重录', 描述: '最简单粗暴的办法，但前面十几分钟录好的内容全部作废。' },
      { 标题: '录完再剪', 描述: '先把整段录完，再用剪辑软件找切点、调衔接、导出——一次口误变成一次完整后期。' },
      { 标题: '带着错误继续', 描述: '当时省事不停下来，但错误一直留在成片里，迟早还是得返工处理。' },
      { 标题: '上传到线上服务', 描述: '要等大文件传完不说，录的要是内部系统或未发布的产品，素材离开本机也不放心。' },
    ]
    let 卡片区 = 创建元素('div', { className: 'problem-grid' })
    for (let 问题 of 问题列表) {
      let 卡片 = 创建元素('article', { className: 'problem-card' })
      卡片.append(创建元素('h3', { textContent: 问题.标题 }), 创建元素('p', { textContent: 问题.描述 }))
      卡片区.append(卡片)
    }
    let 答案 = 创建元素('div', { className: 'answer' })
    答案.append(
      创建元素('span', { textContent: '补录录的思路' }),
      创建元素('strong', { textContent: '出了错，当场就改。' }),
      创建元素('p', {
        textContent: '停下来，把播放头退回到说对的地方。前面的内容不动，后面的错误丢掉，从这里接着录下去就好。',
      }),
    )
    let 区域 = 创建元素('section', { className: 'problem-section' })
    区域.append(
      创建元素('p', { className: 'eyebrow', textContent: '录到中途出了错' }),
      创建元素('h2', { textContent: '常见的处理办法，都不太理想。' }),
      创建元素('p', {
        className: 'lead',
        textContent:
          '不想做后期，只想一边操作一边说清楚，录完直接交付。可是讲着讲着总会说错——普通录屏只能硬着头皮继续或者从头再来，专业剪辑又杀鸡用牛刀。',
      }),
      卡片区,
      答案,
    )
    let 样式 = 创建元素('style', {
      textContent: `
        .problem-section { max-width: 1180px; margin: 0 auto; padding: 96px 28px 48px; box-sizing: border-box; }
        .problem-section > h2 { max-width: 860px; margin: 8px 0 20px; font-size: clamp(32px, 5vw, 56px); line-height: 1.08; letter-spacing: -.045em; }
        .problem-section .lead { max-width: 780px; margin: 0; color: #aeb2c9; font-size: 16px; line-height: 1.8; }
        .problem-section .eyebrow { color: #65e1d3; margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .18em; }
        .problem-grid { margin-top: 42px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .problem-card { padding: 24px; border-left: 2px solid rgba(255,102,94,.7); background: rgba(255,255,255,.035); box-sizing: border-box; }
        .problem-card h3 { margin: 0 0 12px; color: #f2f1ff; font-size: 18px; }
        .problem-card p { margin: 0; color: #9298b3; font-size: 13px; line-height: 1.7; }
        .answer { margin-top: 18px; padding: 28px 32px; display: grid; grid-template-columns: 150px 1fr 1.6fr; gap: 24px; align-items: center; border: 1px solid rgba(101,225,211,.24); border-radius: 18px; background: linear-gradient(110deg, rgba(78,217,196,.1), rgba(116,87,255,.1)); }
        .answer span { color: #65e1d3; font-size: 12px; font-weight: 800; letter-spacing: .08em; }
        .answer strong { font-size: 21px; }
        .answer p { margin: 0; color: #aeb2c9; font-size: 14px; line-height: 1.7; }
        @media (max-width: 900px) { .problem-grid { grid-template-columns: repeat(2, 1fr); } .answer { grid-template-columns: 1fr; gap: 10px; } }
        @media (max-width: 560px) { .problem-section { padding: 72px 18px 32px; } .problem-grid { grid-template-columns: 1fr; } .answer { padding: 24px; } }
      `,
    })
    let 包装 = 创建元素('div')
    包装.append(样式, 区域)
    return 包装
  }

  private 创建特性区(): HTMLElement {
    let 特性 = [
      {
        编号: '01',
        标题: '回退续录',
        描述: '把播放头拖回出错的位置，前面的录制原样保留，后面的错误丢掉，从这里重新录。',
      },
      { 编号: '02', 标题: '声音一起录', 描述: '系统音频和麦克风分开控制、实时混音，波形一眼就能看到停顿和杂音在哪。' },
      {
        编号: '03',
        标题: '规则化剪辑',
        描述: '设定音量范围和时长条件，自动匹配静音或停顿片段，预览即时生效，一套规则反复用。',
      },
      { 编号: '04', 标题: '原画导出', 描述: '尽量直接封装已录好的音视频数据，跳过不必要的重新编码，又快画质又好。' },
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
      创建元素('p', { className: 'eyebrow', textContent: '录制到交付' }),
      创建元素('h2', { textContent: '出错了？退回去接着录。' }),
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

  private 创建场景区(): HTMLElement {
    let 场景列表 = [
      { 标题: '软件教程', 描述: '边点边说的操作讲解，中途口误不用从头再来。' },
      { 标题: '产品演示', 描述: '给客户或团队录一段连贯的功能走查，说错了退回去接着录。' },
      { 标题: '课程与培训', 描述: '前面讲得好好的就别浪费了，只返工从出错那句开始的部分。' },
      { 标题: '流程讲解', 描述: '系统声音和麦克风一起收，录完就是一份完整的内部知识文档。' },
    ]
    let 列表 = 创建元素('div', { className: 'scenario-list' })
    for (let 场景 of 场景列表) {
      let 项 = 创建元素('article', { className: 'scenario-item' })
      项.append(创建元素('h3', { textContent: 场景.标题 }), 创建元素('p', { textContent: 场景.描述 }))
      列表.append(项)
    }
    let 标题区 = 创建元素('div', { className: 'scenario-heading' })
    标题区.append(
      创建元素('p', { className: 'eyebrow', textContent: '适合哪些场景' }),
      创建元素('h2', { textContent: '为「边操作边讲解」的录屏而做。' }),
      创建元素('p', {
        textContent: '补录录只做录制过程中的快速返工，不搞复杂特效和多轨合成。少一点编辑选项，换来更顺畅的录制体验。',
      }),
    )
    let 区域 = 创建元素('section', { className: 'scenario-section' })
    区域.append(标题区, 列表)
    let 样式 = 创建元素('style', {
      textContent: `
        .scenario-section { max-width: 1180px; margin: 0 auto; padding: 86px 28px 68px; display: grid; grid-template-columns: .8fr 1.2fr; gap: 72px; box-sizing: border-box; }
        .scenario-heading .eyebrow { margin: 0 0 12px; color: #65e1d3; font-size: 13px; font-weight: 700; letter-spacing: .18em; }
        .scenario-heading h2 { margin: 0 0 20px; font-size: clamp(32px, 4vw, 48px); line-height: 1.1; letter-spacing: -.04em; }
        .scenario-heading > p:last-child { margin: 0; color: #aeb2c9; font-size: 14px; line-height: 1.8; }
        .scenario-list { border-top: 1px solid rgba(255,255,255,.12); }
        .scenario-item { padding: 22px 0; display: grid; grid-template-columns: 140px 1fr; gap: 24px; border-bottom: 1px solid rgba(255,255,255,.12); }
        .scenario-item h3 { margin: 0; color: #f2f1ff; font-size: 17px; }
        .scenario-item p { margin: 0; color: #9298b3; font-size: 14px; line-height: 1.7; }
        @media (max-width: 800px) { .scenario-section { grid-template-columns: 1fr; gap: 42px; } }
        @media (max-width: 560px) { .scenario-section { padding: 60px 18px 50px; } .scenario-item { grid-template-columns: 1fr; gap: 8px; } }
      `,
    })
    let 包装 = 创建元素('div')
    包装.append(样式, 区域)
    return 包装
  }

  private 创建工作流区(): HTMLElement {
    let 条目 = [
      { 编号: '01', 标题: '不用一口气说完', 描述: '想好一句再说，中间想多久都没关系。录的时候完全不用赶节奏。' },
      { 编号: '02', 标题: '停顿自动消失', 描述: '沉默和长停顿会被剪辑规则自动识别并去掉，成片听起来依然流畅连贯。' },
      {
        编号: '03',
        标题: '说错了就退回去',
        描述: '不需要从头重来，退回出错的位置接着录就行。前面录好的内容原封不动。',
      },
    ]
    let 网格 = 创建元素('div', { className: 'workflow-grid' })
    for (let 项 of 条目) {
      let 卡片 = 创建元素('article', { className: 'workflow-card' })
      卡片.append(
        创建元素('span', { className: 'workflow-number', textContent: 项.编号 }),
        创建元素('h3', { textContent: 项.标题 }),
        创建元素('p', { textContent: 项.描述 }),
      )
      网格.append(卡片)
    }
    let 区域 = 创建元素('section', { className: 'workflow-section' })
    区域.append(
      创建元素('p', { className: 'eyebrow', textContent: '推荐的录制方式' }),
      创建元素('h2', { textContent: '放慢节奏录，也能得到流畅的成片。' }),
      创建元素('p', {
        className: 'workflow-lead',
        textContent:
          '回退续录解决「说错了」的问题，自动剪辑解决「说慢了」的问题。两者配合，录制时可以降低心理压力，不用追求一遍过。',
      }),
      网格,
    )
    let 样式 = 创建元素('style', {
      textContent: `
        .workflow-section { max-width: 1180px; margin: 0 auto; padding: 96px 28px 48px; box-sizing: border-box; }
        .workflow-section > h2 { margin: 8px 0 16px; font-size: clamp(30px, 5vw, 52px); letter-spacing: -.04em; }
        .workflow-section .eyebrow { color: #65e1d3; margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .18em; }
        .workflow-lead { max-width: 720px; margin: 0 0 36px; color: #aeb2c9; font-size: 16px; line-height: 1.8; }
        .workflow-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .workflow-card { padding: 28px; border-radius: 22px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.045); box-sizing: border-box; }
        .workflow-number { color: #65e1d3; font: 700 13px monospace; }
        .workflow-card h3 { margin: 20px 0 12px; font-size: 21px; }
        .workflow-card p { margin: 0; color: #aeb2c9; line-height: 1.75; font-size: 14px; }
        @media (max-width: 900px) { .workflow-grid { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .workflow-section { padding: 70px 18px 32px; } }
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
      创建元素('p', { textContent: '所有处理都在你的浏览器里完成' }),
      创建元素('h2', { textContent: '下次录到一半说错了，退回去就好。' }),
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
