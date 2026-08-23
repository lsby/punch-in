import { 主要按钮, 文本按钮 } from '../../../components/general/base/base-button'
import { 普通输入框 } from '../../../components/general/form/form-input'
import { 关闭模态框, 显示模态框 } from '../../../global/manager/modal-manager'
import { 创建元素 } from '../../../global/tools/create-element'
import { 导出配置 } from './video-exporter'

export async function 显示视频导出面板(执行导出: (配置: 导出配置) => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    let 容器 = 创建元素('div', {
      style: {
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        color: '#e5e7eb',
        maxHeight: '80vh',
        overflowY: 'auto',
      },
    })
    let 文件名行 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } })
    文件名行.appendChild(创建元素('label', { textContent: '文件名', style: { fontSize: '14px', fontWeight: 'bold' } }))
    let 文件名输入 = new 普通输入框({ 值: `录制_${new Date().getTime()}`, 占位符: '请输入文件名' })
    文件名行.appendChild(文件名输入)

    let 说明容器 = 创建元素('div', {
      style: {
        padding: '12px',
        backgroundColor: '#2a2e36',
        borderRadius: '8px',
        fontSize: '13px',
        lineHeight: '1.6',
        borderLeft: '4px solid #3b82f6',
      },
    })
    说明容器.innerHTML = `
      <div style="color: #60a5fa; font-weight: bold; margin-bottom: 4px;">原画导出</div>
      <div style="color: #9ca3af;">直接封装原始音视频，并应用当前启用的剪辑规则。</div>
      <div style="color: #9ca3af;">为保证视频可解码，裁剪起点会对齐到下一个关键帧。</div>
    `

    let 进度容器 = 创建元素('div', { style: { display: 'none', flexDirection: 'column', gap: '8px' } })
    let 进度文本 = 创建元素('div', {
      style: { color: '#cbd5e1', fontSize: '13px', display: 'flex', justifyContent: 'space-between' },
    })
    let 阶段文本 = 创建元素('span', { textContent: '准备导出' })
    let 百分比文本 = 创建元素('span', { textContent: '0%' })
    进度文本.append(阶段文本, 百分比文本)
    let 进度条 = 创建元素('progress', { style: { width: '100%', height: '14px', accentColor: '#3b82f6' } })
    进度条.max = 1
    进度条.value = 0
    进度容器.append(进度文本, 进度条)

    let 底部 = 创建元素('div', {
      style: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' },
    })
    let 取消按钮 = new 文本按钮({
      文本: '取消',
      点击处理函数: async (): Promise<void> => {
        await 关闭模态框()
        resolve()
      },
    })
    let 确认导出按钮 = new 主要按钮({
      文本: '开始导出',
      点击处理函数: async (): Promise<void> => {
        进度容器.style.display = 'flex'
        进度条.value = 0
        阶段文本.textContent = '正在准备导出'
        阶段文本.style.color = '#cbd5e1'
        百分比文本.textContent = '0%'
        确认导出按钮.设置禁用(true)
        确认导出按钮.设置文本('正在导出')
        取消按钮.设置禁用(true)
        let 配置: 导出配置 = {
          文件名: 文件名输入.获得值() !== '' ? 文件名输入.获得值() : '未命名',
          进度回调: (进度): void => {
            进度条.value = 进度.进度
            阶段文本.textContent = 进度.阶段
            百分比文本.textContent = `${Math.round(进度.进度 * 100)}%`
          },
        }
        try {
          let 导出事件 = 执行导出(配置)
          await 导出事件
          确认导出按钮.设置文本('导出完成')
          取消按钮.设置文本('关闭')
        } catch (错误) {
          阶段文本.textContent = `导出失败：${String(错误)}`
          阶段文本.style.color = '#fca5a5'
          确认导出按钮.设置文本('重新导出')
          确认导出按钮.设置禁用(false)
          取消按钮.设置文本('取消')
        }
        取消按钮.设置禁用(false)
      },
    })
    底部.append(取消按钮, 确认导出按钮)
    容器.append(文件名行, 说明容器, 进度容器, 底部)
    void 显示模态框({ 标题: '原画导出 MP4', 宽度: '480px', 高度: 'auto', 可关闭: false }, 容器)
  })
}
