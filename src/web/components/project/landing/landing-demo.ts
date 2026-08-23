import { 组件基类 } from '../../../base/base'
import { 创建元素 } from '../../../global/tools/create-element'

type 发出事件类型 = Record<string, never>
type 监听事件类型 = Record<string, never>
type 演示阶段 = '空时间轴' | '口误已出现' | '已回退' | '补录完成'

export class 补录时间轴动画组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-punch-in-timeline-demo', this)
  }

  private 定时器列表: number[] = []
  private 已录区域 = 创建元素('div', { className: 'recorded' })
  private 口误区域 = 创建元素('div', { className: 'wrong' })
  private 修正区域 = 创建元素('div', { className: 'repair' })
  private 续录区域 = 创建元素('div', { className: 'continued' })
  private 播放头 = 创建元素('div', { className: 'playhead' })
  private 口误标记 = 创建元素('span', { className: 'marker', textContent: '口误起点' })
  private 预览文本 = 创建元素('strong', { textContent: '准备开始录制屏幕' })
  private 状态文本 = 创建元素('span', { textContent: '时间轴还是空的' })
  private 状态容器 = 创建元素('div', { className: 'status is-idle' })
  private 演示按钮 = 创建元素('button', { className: 'action', textContent: '开始录制' })
  private 步骤列表: HTMLDivElement[] = []
  private 当前阶段: 演示阶段 = '空时间轴'

  protected override async 当加载时(): Promise<void> {
    let 是否精简 = this.hasAttribute('精简')
    let 样式 = 创建元素('style', {
      textContent: `
        :host { display: block; min-width: 0; }
        .shell { position: relative; padding: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,.12); border-radius: 26px; background: linear-gradient(155deg, rgba(35,38,71,.96), rgba(16,18,36,.98)); box-shadow: 0 30px 80px rgba(0,0,0,.32); box-sizing: border-box; }
        .shell::before { content: ''; position: absolute; width: 240px; height: 240px; right: -80px; top: -120px; border-radius: 50%; background: #7257ff; filter: blur(80px); opacity: .22; pointer-events: none; }
        .topbar { position: relative; display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
        .title { color: #f2f1ff; font-size: 13px; font-weight: 800; }
        .status { display: inline-flex; align-items: center; gap: 7px; color: #aeb2c9; font-size: 12px; }
        .status::before { content: ''; width: 7px; height: 7px; flex: none; border-radius: 50%; transition: background .25s ease, box-shadow .25s ease; }
        .status.is-idle::before { background: #747b99; }
        .status.is-recording::before { background: #a897ff; box-shadow: 0 0 12px rgba(168,151,255,.7); }
        .status.is-error::before { background: #ff665e; box-shadow: 0 0 12px rgba(255,102,94,.72); }
        .status.is-ready::before { background: #ffe078; box-shadow: 0 0 12px rgba(255,224,120,.62); }
        .status.is-success::before { background: #4ed9c4; box-shadow: 0 0 12px rgba(78,217,196,.7); }
        .preview { position: relative; min-height: ${是否精简 === true ? '150px' : '180px'}; padding: 26px; display: flex; flex-direction: column; justify-content: flex-end; border-radius: 17px; background: linear-gradient(135deg, #24284a, #173943); box-sizing: border-box; overflow: hidden; }
        .preview::after { content: ''; position: absolute; width: 130px; height: 130px; right: 8%; top: -30px; border-radius: 50%; background: rgba(115,87,255,.18); }
        .preview-label { position: absolute; left: 24px; top: 20px; color: #7e86a5; font: 700 10px monospace; letter-spacing: .14em; }
        .preview strong { position: relative; z-index: 1; max-width: 82%; color: #f5f4ff; font-size: clamp(16px, 2.2vw, 23px); line-height: 1.45; }
        .timeline-label { margin: 18px 2px 8px; display: flex; justify-content: space-between; color: #747b99; font: 700 10px monospace; letter-spacing: .1em; }
        .track { position: relative; height: 54px; margin: 0 5px; overflow: visible; border-radius: 10px; background: #0a0d1d; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
        .track::before { content: ''; position: absolute; inset: 8px 10px; border-radius: 5px; background: repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 8%); }
        .recorded, .wrong, .repair, .continued { position: absolute; top: 8px; bottom: 8px; left: 0; width: 0; border-radius: 5px; box-sizing: border-box; }
        .recorded { background: linear-gradient(90deg, #5e55d7, #8171ef); }
        .recorded.is-forward { width: 68%; transition: width 2.5s linear; }
        .wrong { z-index: 2; left: 48%; background: linear-gradient(90deg, #d3414b, #ff6b5f); box-shadow: 0 0 18px rgba(255,85,78,.3); }
        .wrong.is-visible { width: 20%; transition: width .8s linear; }
        .wrong.is-fixed { width: 20%; opacity: 0; transition: opacity .3s ease; }
        .repair { z-index: 3; left: 48%; background: linear-gradient(90deg, #27c4ae, #51ddc9); }
        .repair.is-filling { width: 20%; transition: width 1.2s linear; }
        .continued { z-index: 3; left: 68%; background: linear-gradient(90deg, #8171ef, #9b8cff); }
        .continued.is-filling { width: 20%; transition: width 1.2s linear 1.2s; }
        .playhead { position: absolute; z-index: 5; left: 0; top: -8px; bottom: -8px; width: 2px; background: #ffe078; opacity: 0; }
        .playhead::before { content: ''; position: absolute; width: 9px; height: 9px; left: -3px; top: -2px; border-radius: 50%; background: #ffe078; box-shadow: 0 0 12px rgba(255,224,120,.65); }
        .playhead.is-forward { left: 68%; opacity: 1; transition: left 2.5s linear; }
        .playhead.is-rewinding { left: 48%; opacity: 1; transition: left .7s cubic-bezier(.6,0,.8,.4); }
        .playhead.is-retaking { left: 88%; opacity: 1; transition: left 2.4s linear; }
        .marker { position: absolute; z-index: 6; left: 48%; top: -25px; padding: 3px 7px; color: #ff968e; border: 1px solid rgba(255,102,94,.35); border-radius: 999px; background: #251d2b; font-size: 9px; transform: translateX(-50%); opacity: 0; transition: opacity .2s ease; }
        .marker.is-visible { opacity: 1; }
        .controls { min-height: 42px; margin-top: 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .hint { color: #777e9b; font-size: 11px; line-height: 1.5; }
        .action { flex: none; min-width: 104px; padding: 10px 16px; color: #111326; border: 0; border-radius: 999px; background: #f2f0ff; font-weight: 800; cursor: pointer; transition: transform .2s ease, opacity .2s ease, box-shadow .2s ease; }
        .action:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(168,151,255,.24); }
        .action:disabled { opacity: .46; cursor: default; }
        .steps { margin-top: 18px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
        .step { padding: 9px 6px; color: #9299b6; border: 1px solid rgba(255,255,255,.07); border-radius: 9px; font-size: 9px; text-align: center; transition: color .2s ease, border-color .2s ease, background .2s ease; }
        .step b { display: block; margin-bottom: 4px; color: #b9b1ff; font: 700 9px monospace; }
        .step.is-active { color: #f2f0ff; border-color: rgba(168,151,255,.4); background: rgba(116,87,255,.13); }
        .step.is-active b { color: #65e1d3; }
        .compact .steps { display: none; }
        @media (prefers-reduced-motion: reduce) { .recorded, .wrong, .repair, .continued, .playhead { transition-duration: .01ms !important; transition-delay: 0ms !important; } }
        @media (max-width: 560px) { .shell { padding: 13px; border-radius: 20px; } .topbar { align-items: flex-start; } .status { max-width: 52%; text-align: right; } .preview { min-height: 140px; padding: 20px; } .preview-label { left: 19px; top: 16px; } .preview strong { max-width: 95%; } .controls { align-items: flex-end; } .steps { grid-template-columns: repeat(2, 1fr); } }
      `,
    })
    this.演示按钮.onclick = (): void => this.推进演示()
    let 顶栏 = 创建元素('div', { className: 'topbar' })
    this.状态容器.append(this.状态文本)
    顶栏.append(创建元素('span', { className: 'title', textContent: '时间轴上的一次回退续录' }), this.状态容器)
    let 预览 = 创建元素('div', { className: 'preview' })
    预览.append(创建元素('span', { className: 'preview-label', textContent: '录制画面' }), this.预览文本)
    let 轨道 = 创建元素('div', { className: 'track' })
    轨道.append(this.已录区域, this.口误区域, this.修正区域, this.续录区域, this.播放头, this.口误标记)
    let 时间轴标题 = 创建元素('div', { className: 'timeline-label' })
    时间轴标题.append(
      创建元素('span', { textContent: '录制时间轴' }),
      创建元素('span', { textContent: '00:00 — 00:12' }),
    )
    let 控制区 = 创建元素('div', { className: 'controls' })
    控制区.append(创建元素('span', { className: 'hint', textContent: '点击右侧按钮，逐步查看补录过程' }), this.演示按钮)
    let 步骤区 = 创建元素('div', { className: 'steps' })
    for (let 项 of ['空时间轴', '开始录制', '发现口误', '回退续录', '修正完成']) {
      let 步骤 = 创建元素('div', { className: 'step' })
      步骤.append(创建元素('b', { textContent: String(步骤区.childElementCount + 1) }), 项)
      步骤区.append(步骤)
      this.步骤列表.push(步骤)
    }
    let 外壳 = 创建元素('div', { className: 是否精简 === true ? 'shell compact' : 'shell' })
    外壳.append(顶栏, 预览, 时间轴标题, 轨道, 控制区, 步骤区)
    this.shadow.append(样式, 外壳)
    this.重置演示()
  }

  protected override async 当卸载时(): Promise<void> {
    this.清理定时器()
  }

  private 安排任务(任务: () => void, 延迟: number): void {
    this.定时器列表.push(window.setTimeout(任务, 延迟))
  }

  private 清理定时器(): void {
    for (let 定时器 of this.定时器列表) window.clearTimeout(定时器)
    this.定时器列表 = []
  }

  private 重置演示(): void {
    this.清理定时器()
    this.当前阶段 = '空时间轴'
    this.已录区域.className = 'recorded'
    this.口误区域.className = 'wrong'
    this.修正区域.className = 'repair'
    this.续录区域.className = 'continued'
    this.播放头.className = 'playhead'
    this.口误标记.className = 'marker'
    this.预览文本.textContent = '准备开始录制屏幕'
    this.状态文本.textContent = '时间轴还是空的'
    this.状态容器.className = 'status is-idle'
    this.演示按钮.textContent = '开始录制'
    this.演示按钮.disabled = false
    this.更新步骤(0)
  }

  private 推进演示(): void {
    switch (this.当前阶段) {
      case '空时间轴':
        this.开始录制()
        break
      case '口误已出现':
        this.退回口误起点()
        break
      case '已回退':
        this.开始补录()
        break
      case '补录完成':
        this.重置演示()
        break
    }
  }

  private 更新步骤(当前序号: number): void {
    for (let 序号 = 0; 序号 < this.步骤列表.length; 序号 += 1) {
      this.步骤列表[序号]?.setAttribute('class', 序号 === 当前序号 ? 'step is-active' : 'step')
    }
  }

  private 开始录制(): void {
    this.清理定时器()
    this.演示按钮.disabled = true
    this.演示按钮.textContent = '正在录制'
    this.已录区域.className = 'recorded is-forward'
    this.播放头.className = 'playhead is-forward'
    this.预览文本.textContent = '正在录制……'
    this.状态文本.textContent = '录制从时间轴起点开始'
    this.状态容器.className = 'status is-recording'
    this.更新步骤(1)
    this.安排任务((): void => {
      this.口误区域.className = 'wrong is-visible'
      this.口误标记.className = 'marker is-visible'
      this.预览文本.textContent = '出现口误'
      this.状态文本.textContent = '录制到这里时出现了口误'
      this.状态容器.className = 'status is-error'
      this.更新步骤(2)
    }, 1650)
    this.安排任务((): void => {
      this.当前阶段 = '口误已出现'
      this.演示按钮.textContent = '退回口误起点'
      this.演示按钮.disabled = false
    }, 2550)
  }

  private 退回口误起点(): void {
    this.清理定时器()
    this.演示按钮.disabled = true
    this.演示按钮.textContent = '正在退回'
    this.播放头.className = 'playhead is-rewinding'
    this.状态文本.textContent = '播放头正在退回口误起点'
    this.状态容器.className = 'status is-ready'
    this.更新步骤(3)
    this.安排任务((): void => {
      this.当前阶段 = '已回退'
      this.预览文本.textContent = '已经回到说错前，可以从这里重新录制'
      this.状态文本.textContent = '继续录制会删除播放头后的旧内容'
      this.演示按钮.textContent = '开始续录'
      this.演示按钮.disabled = false
    }, 750)
  }

  private 开始补录(): void {
    this.清理定时器()
    this.演示按钮.textContent = '正在续录'
    this.演示按钮.disabled = true
    this.修正区域.className = 'repair is-filling'
    this.续录区域.className = 'continued is-filling'
    this.播放头.className = 'playhead is-retaking'
    this.预览文本.textContent = '快速修正口误'
    this.状态文本.textContent = '从口误起点重录，后方旧内容已舍弃'
    this.状态容器.className = 'status is-recording'
    this.更新步骤(4)
    this.安排任务((): void => {
      this.口误区域.className = 'wrong is-fixed'
      this.状态文本.textContent = '口误和后续旧内容正由新录制替代'
      this.状态容器.className = 'status is-success'
    }, 1250)
    this.安排任务((): void => {
      this.当前阶段 = '补录完成'
      this.预览文本.textContent = '续录完成，时间轴由新内容继续向前'
      this.状态文本.textContent = '出错点以前保留，此后已经重新录制'
      this.演示按钮.textContent = '重新演示'
      this.演示按钮.disabled = false
    }, 2500)
  }
}

export class 补录落地页演示组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-punch-in-landing-demo', this)
  }

  protected override async 当加载时(): Promise<void> {
    let 样式 = 创建元素('style', {
      textContent: `
        .demo { max-width: 1180px; margin: 0 auto; padding: 72px 28px 96px; display: grid; grid-template-columns: .65fr 1.35fr; gap: 60px; align-items: center; box-sizing: border-box; }
        .eyebrow { margin: 0 0 14px; color: #65e1d3; font-size: 13px; font-weight: 700; letter-spacing: .18em; }
        h2 { margin: 0 0 18px; font-size: clamp(34px, 5vw, 58px); line-height: 1.05; letter-spacing: -.05em; }
        .copy { margin: 0; color: #aeb2c9; line-height: 1.75; }
        @media (max-width: 900px) { .demo { grid-template-columns: 1fr; gap: 38px; } }
        @media (max-width: 560px) { .demo { padding: 56px 18px 76px; } }
      `,
    })
    let 文案 = 创建元素('div')
    文案.append(
      创建元素('p', { className: 'eyebrow', textContent: '看一次实际的回退续录' }),
      创建元素('h2', { textContent: '前面不动，后面重来。' }),
      创建元素('p', {
        className: 'copy',
        textContent:
          '说错了就停下来，把播放头拖回出错的起点。再次录制时，前面的内容原样保留，出错的部分连同后面的旧内容一起丢掉，由这次新录制接上。',
      }),
    )
    let 区域 = 创建元素('section', { className: 'demo' })
    区域.append(文案, new 补录时间轴动画组件())
    this.shadow.append(样式, 区域)
  }
}
