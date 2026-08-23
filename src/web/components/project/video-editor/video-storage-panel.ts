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

export async function 显示存储管理面板(存储: 视频本地存储, 回调: 存储面板回调): Promise<void> {
  let 容器 = 创建元素('div', {
    style: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#e5e7eb' },
  })
  let 统计 = await 存储.获得统计()
  let 摘要 = 创建元素('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  })
  let 摘要项目: [string, string][] = [
    ['本地文件占用', 格式化字节数(统计.录制字节数)],
    ['浏览器可用空间', 格式化字节数(统计.来源可用字节数)],
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
  let 说明 = 创建元素('div', {
    textContent: '本地文件包含录制片段和可能遗留的临时导出文件。清除后无法恢复，请先导出需要保留的内容。',
    style: { color: '#9ca3af', fontSize: '13px', lineHeight: '1.6' },
  })
  let 删除全部 = 创建元素('button', {
    textContent: '清除全部本地文件',
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
    if (confirm(`确定永久清除全部 ${格式化字节数(统计.录制字节数)} 本地文件吗？此操作无法撤销。`) === false) return
    await 存储.删除全部会话()
    await 回调.当前会话已删除()
    await 关闭模态框()
  }
  容器.append(摘要, 说明, 删除全部)
  await 显示模态框({ 标题: '本地存储', 宽度: '520px', 高度: 'auto' }, 容器)
}
