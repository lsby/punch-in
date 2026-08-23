import { 文本按钮 } from '../../../components/general/base/base-button'
import { 关闭模态框, 显示模态框 } from '../../../global/manager/modal-manager'
import { 创建元素 } from '../../../global/tools/create-element'
import { 存储统计, 视频本地存储 } from './video-storage'

export type 存储面板回调 = { 是否允许删除: () => boolean; 当前会话已删除: () => Promise<void> }

export function 格式化字节数(字节数: number): string {
  if (字节数 < 1024) return `${字节数} B`
  if (字节数 < 1024 ** 2) return `${(字节数 / 1024).toFixed(1)} KiB`
  if (字节数 < 1024 ** 3) return `${(字节数 / 1024 ** 2).toFixed(1)} MiB`
  return `${(字节数 / 1024 ** 3).toFixed(2)} GiB`
}

export function 计算可录制秒数(统计: 存储统计, 每秒字节数: number): number {
  if (每秒字节数 <= 0) return 0
  return (统计.来源可用字节数 * 0.8) / 每秒字节数
}

export function 格式化时长(秒数: number): string {
  if (Number.isFinite(秒数) === false || 秒数 <= 0) return '不足 1 分钟'
  let 小时 = Math.floor(秒数 / 3600)
  let 分钟 = Math.floor((秒数 % 3600) / 60)
  if (小时 <= 0) return `${分钟} 分钟`
  return `${小时} 小时 ${分钟} 分钟`
}

export async function 显示存储管理面板(存储: 视频本地存储, 每秒字节数: number, 回调: 存储面板回调): Promise<void> {
  let 容器 = 创建元素('div', {
    style: {
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      color: '#e5e7eb',
      maxHeight: '72vh',
    },
  })
  let 统计 = await 存储.获得统计()
  let 摘要 = 创建元素('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  })
  let 摘要项目: [string, string][] = [
    ['录制素材', 格式化字节数(统计.录制字节数)],
    ['网站总占用', 格式化字节数(统计.来源已用字节数)],
    ['浏览器配额', 格式化字节数(统计.来源配额字节数)],
    ['预计还可录制', 格式化时长(计算可录制秒数(统计, 每秒字节数))],
  ]
  for (let [标签, 值] of 摘要项目) {
    let 卡片 = 创建元素('div', {
      style: { padding: '12px', borderRadius: '8px', backgroundColor: '#252932', border: '1px solid #3b4252' },
    })
    卡片.append(
      创建元素('div', { textContent: 标签, style: { color: '#9ca3af', fontSize: '12px' } }),
      创建元素('div', { textContent: 值, style: { marginTop: '4px', fontSize: '18px', fontWeight: 'bold' } }),
    )
    摘要.append(卡片)
  }
  let 持久状态 = 创建元素('div', {
    textContent: 统计.是否持久
      ? '已启用持久存储保护。浏览器不会因空间压力自动清理这些录制。'
      : '浏览器未授予持久存储保护。请及时导出重要录制。',
    style: {
      padding: '10px 12px',
      borderRadius: '6px',
      color: 统计.是否持久 ? '#86efac' : '#fcd34d',
      backgroundColor: 统计.是否持久 ? 'rgba(22,101,52,.25)' : 'rgba(146,64,14,.25)',
    },
  })
  let 会话容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' } })
  let 会话列表 = await 存储.获得会话列表()
  for (let 会话 of 会话列表) {
    let 行 = 创建元素('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        backgroundColor: '#1f232b',
        borderRadius: '7px',
      },
    })
    let 信息 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', flex: '1' } })
    信息.append(
      创建元素('span', { textContent: new Date(会话.创建时间).toLocaleString(), style: { fontWeight: 'bold' } }),
      创建元素('span', {
        textContent: `${会话.片段数} 个片段 · ${格式化字节数(会话.字节数)} · ${会话.已导出 ? '已导出' : '未导出'}`,
        style: { color: '#9ca3af', fontSize: '12px' },
      }),
    )
    let 删除按钮 = 创建元素('button', {
      textContent: '删除',
      style: {
        padding: '6px 10px',
        color: '#fecaca',
        backgroundColor: '#7f1d1d',
        border: '1px solid #991b1b',
        borderRadius: '6px',
        cursor: 'pointer',
      },
    })
    删除按钮.onclick = async (): Promise<void> => {
      if (回调.是否允许删除() === false) {
        alert('请先停止当前录制和收尾操作')
        return
      }
      if (confirm(`确定永久删除这次录制及其 ${格式化字节数(会话.字节数)} 本地素材吗？`) === false) return
      if (await 存储.删除会话(会话.会话ID)) await 回调.当前会话已删除()
      行.remove()
    }
    行.append(信息, 删除按钮)
    会话容器.append(行)
  }
  let 操作栏 = 创建元素('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px' } })
  let 删除已导出 = new 文本按钮({
    文本: '删除所有已导出录制',
    点击处理函数: async (): Promise<void> => {
      if (回调.是否允许删除() === false || confirm('确定永久删除所有已经导出的本地录制吗？') === false) return
      if (await 存储.删除已导出会话()) await 回调.当前会话已删除()
      await 关闭模态框()
    },
  })
  let 删除全部 = 创建元素('button', {
    textContent: '删除全部本地录制',
    style: {
      padding: '8px 12px',
      color: '#fff',
      backgroundColor: '#b91c1c',
      border: '1px solid #dc2626',
      borderRadius: '7px',
      cursor: 'pointer',
    },
  })
  删除全部.onclick = async (): Promise<void> => {
    if (回调.是否允许删除() === false) {
      alert('请先停止当前录制和收尾操作')
      return
    }
    if (confirm(`确定永久删除全部 ${格式化字节数(统计.录制字节数)} 本地录制吗？此操作无法撤销。`) === false) return
    await 存储.删除全部会话()
    await 回调.当前会话已删除()
    await 关闭模态框()
  }
  操作栏.append(删除已导出, 删除全部)
  容器.append(摘要, 持久状态, 会话容器, 操作栏)
  await 显示模态框({ 标题: '本地存储管理', 宽度: '680px', 高度: 'auto' }, 容器)
}
