import { 创建元素 } from '../../../global/tools/create-element'

export type 控制栏按钮集合 = {
  控制栏: HTMLElement
  录制按钮: HTMLButtonElement
  选择屏幕按钮: HTMLButtonElement
  撤销按钮: HTMLButtonElement
  重做按钮: HTMLButtonElement
  切换混音器按钮: HTMLButtonElement
  剪辑规则按钮: HTMLButtonElement
  导出按钮: HTMLButtonElement
}

export function 创建控制栏(判断是否正在录制: () => boolean): 控制栏按钮集合 {
  let 顶部控制栏 = 创建元素('div', {
    style: {
      display: 'flex',
      gap: '12px',
      padding: '12px',
      backgroundColor: '#1a1e23',
      borderRadius: '12px',
      border: '1px solid #333',
      alignItems: 'center',
    },
  })

  let 录制按钮 = 创建元素('button', {
    textContent: '🔴 开始录制',
    style: {
      padding: '8px 24px',
      backgroundColor: '#dc2626',
      color: '#fff',
      border: '1px solid #ef4444',
      borderRadius: '8px',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      outline: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    },
  })
  录制按钮.onmouseenter = (): void => {
    let 正在录制 = 判断是否正在录制()
    录制按钮.style.backgroundColor = 正在录制 ? '#6b7280' : '#ef4444'
    录制按钮.style.transform = 'translateY(-1px)'
    录制按钮.style.boxShadow = 正在录制 ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)'
  }
  录制按钮.onmouseleave = (): void => {
    let 正在录制 = 判断是否正在录制()
    录制按钮.style.backgroundColor = 正在录制 ? '#4b5563' : '#dc2626'
    录制按钮.style.transform = 'translateY(0)'
    录制按钮.style.boxShadow = 正在录制 ? 'none' : '0 2px 4px rgba(0,0,0,0.2)'
  }

  let 选择屏幕按钮 = 创建工具按钮('🖥 选择录制屏幕')
  选择屏幕按钮.style.marginLeft = 'auto'

  let 撤销按钮 = 创建工具按钮('↩️ 撤销')
  let 重做按钮 = 创建工具按钮('↪️ 重做')
  let 切换混音器按钮 = 创建工具按钮('🎚️ 混音器')
  let 剪辑规则按钮 = 创建工具按钮('✂️ 剪辑规则')

  let 导出按钮 = 创建元素('button', {
    textContent: '💾 导出 MP4',
    style: {
      padding: '8px 16px',
      backgroundColor: '#2563eb',
      color: '#fff',
      border: '1px solid #3b82f6',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.2s',
    },
  })
  导出按钮.onmouseenter = (): void => {
    导出按钮.style.backgroundColor = '#1d4ed8'
    导出按钮.style.borderColor = '#2563eb'
  }
  导出按钮.onmouseleave = (): void => {
    导出按钮.style.backgroundColor = '#2563eb'
    导出按钮.style.borderColor = '#3b82f6'
  }

  顶部控制栏.append(录制按钮, 撤销按钮, 重做按钮, 选择屏幕按钮, 切换混音器按钮, 剪辑规则按钮, 导出按钮)

  return { 控制栏: 顶部控制栏, 录制按钮, 选择屏幕按钮, 撤销按钮, 重做按钮, 切换混音器按钮, 剪辑规则按钮, 导出按钮 }
}

function 创建工具按钮(文本: string): HTMLButtonElement {
  let 按钮 = 创建元素('button', {
    textContent: 文本,
    style: {
      padding: '8px 16px',
      backgroundColor: '#2d333b',
      color: '#adbac7',
      border: '1px solid #444c56',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.2s',
    },
  })
  按钮.onmouseenter = (): void => {
    按钮.style.backgroundColor = '#444c56'
    按钮.style.borderColor = '#768390'
  }
  按钮.onmouseleave = (): void => {
    按钮.style.backgroundColor = '#2d333b'
    按钮.style.borderColor = '#444c56'
  }
  return 按钮
}
