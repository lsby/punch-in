import { 主要按钮 } from '../../../components/general/base/base-button'
import { 切换开关 } from '../../../components/general/form/form-switch'
import { 关闭模态框, 显示模态框 } from '../../../global/manager/modal-manager'
import { 创建元素 } from '../../../global/tools/create-element'

export type 屏幕选择结果 = { 屏幕ID: string; 录制系统音频: boolean; 录制麦克风: boolean }
export type 浏览器采集设置 = Omit<屏幕选择结果, '屏幕ID'>

export async function 弹出Electron屏幕选择(): Promise<屏幕选择结果 | null> {
  let api = window.electronAPI
  if (api?.获取屏幕列表 === undefined) return null
  return new Promise(async (resolve) => {
    let 屏幕列表 = await api.获取屏幕列表()
    let 容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } })
    let 录制音频开关 = new 切换开关({ 标签: '录制系统音频', 值: true })
    let 录制麦克风开关 = new 切换开关({ 标签: '录制麦克风', 值: true })
    let 内容容器 = 创建元素('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px',
        justifyContent: 'center',
        overflowY: 'auto',
        flex: '1',
      },
    })
    let 底部栏 = 创建元素('div', {
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '16px',
        padding: '16px 24px',
        alignItems: 'center',
        backgroundColor: '#1f2937',
        borderTop: '1px solid #374151',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.2)',
      },
    })
    底部栏.append(录制音频开关, 录制麦克风开关)
    容器.append(内容容器, 底部栏)
    for (let 屏幕 of 屏幕列表) {
      let 卡片 = 创建元素('div', {
        style: {
          width: '200px',
          backgroundColor: '#2a2e36',
          borderRadius: '8px',
          padding: '12px',
          cursor: 'pointer',
          border: '2px solid transparent',
          transition: 'all 0.2s',
        },
      })
      卡片.onmouseenter = (): void => {
        卡片.style.borderColor = '#4f46e5'
      }
      卡片.onmouseleave = (): void => {
        卡片.style.borderColor = 'transparent'
      }
      卡片.onclick = async (): Promise<void> => {
        resolve({ 屏幕ID: 屏幕.id, 录制系统音频: 录制音频开关.获得值(), 录制麦克风: 录制麦克风开关.获得值() })
        await 关闭模态框()
      }
      let 缩略图 = 创建元素('img', {
        style: { width: '100%', height: '120px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '4px' },
      })
      缩略图.src = 屏幕.thumbnail
      let 名称 = 创建元素('div', {
        textContent: 屏幕.name,
        style: {
          color: '#fff',
          fontSize: '12px',
          marginTop: '8px',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      })
      卡片.append(缩略图, 名称)
      内容容器.append(卡片)
    }
    await 显示模态框(
      { 标题: '选择要录制的屏幕或窗口', 宽度: '800px', 高度: '600px', 关闭回调: () => resolve(null) },
      容器,
    )
  })
}

export async function 弹出浏览器采集设置(): Promise<浏览器采集设置 | null> {
  return new Promise((resolve) => {
    let 容器 = 创建元素('div', { style: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' } })
    let 系统音频 = new 切换开关({ 标签: '录制系统音频', 值: true })
    let 麦克风 = new 切换开关({ 标签: '录制麦克风', 值: true })
    let 继续按钮 = new 主要按钮({
      文本: '继续选择屏幕',
      点击处理函数: async (): Promise<void> => {
        resolve({ 录制系统音频: 系统音频.获得值(), 录制麦克风: 麦克风.获得值() })
        await 关闭模态框()
      },
    })
    容器.append(系统音频, 麦克风, 继续按钮)
    void 显示模态框({ 标题: '录制内容', 宽度: '420px', 高度: 'auto', 关闭回调: () => resolve(null) }, 容器)
  })
}
