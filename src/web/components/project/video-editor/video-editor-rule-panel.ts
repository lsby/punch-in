import { 创建元素 } from '../../../global/tools/create-element'
import { 打开规则编辑模态框 } from './video-editor-rule-modal'
import { 裁剪规则 } from './video-editor-types'
import { 生成规则展示信息 } from './video-editor-utils'

export type 规则变化回调 = (规则列表: 裁剪规则[]) => void

export function 创建规则面板(规则变化时: 规则变化回调): {
  面板元素: HTMLElement
  获取规则列表: () => 裁剪规则[]
  设置规则列表: (列表: 裁剪规则[]) => void
} {
  let 当前规则列表: 裁剪规则[] = []

  let 面板容器 = 创建元素('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px',
      backgroundColor: '#1a1e23',
      borderRadius: '12px',
      border: '1px solid #333',
      height: '100%',
      boxSizing: 'border-box',
    },
  })

  let 头部 = 创建元素('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } })

  let 标题 = 创建元素('div', {
    textContent: '✂️ 剪辑规则',
    style: { color: '#e5e7eb', fontSize: '14px', fontWeight: '600' },
  })

  let 添加按钮 = 创建元素('button', {
    textContent: '＋ 添加规则',
    style: {
      padding: '6px 14px',
      backgroundColor: '#4f46e5',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
      transition: 'all 0.2s',
    },
  })
  添加按钮.onmouseenter = (): void => {
    添加按钮.style.backgroundColor = '#6366f1'
    添加按钮.style.transform = 'translateY(-1px)'
  }
  添加按钮.onmouseleave = (): void => {
    添加按钮.style.backgroundColor = '#4f46e5'
    添加按钮.style.transform = 'none'
  }
  添加按钮.onclick = async (): Promise<void> => {
    await 打开规则编辑模态框(undefined, (规则) => {
      当前规则列表.push(规则)
      渲染列表()
      规则变化时(当前规则列表)
    })
  }

  头部.append(标题, 添加按钮)

  let 列表容器 = 创建元素('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '8px', flex: '1', overflowY: 'auto', paddingRight: '4px' },
  })

  let 空提示 = 创建元素('div', {
    textContent: '暂无剪辑规则，点击上方按钮添加',
    style: { color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '20px 0' },
  })

  let 渲染列表 = (): void => {
    列表容器.innerHTML = ''
    if (当前规则列表.length === 0) {
      列表容器.append(空提示)
      return
    }

    当前规则列表.forEach((规则, 索引) => {
      let 展示信息 = 生成规则展示信息(规则)
      let 是否禁用 = 规则.已禁用 === true

      let 卡片 = 创建元素('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          backgroundColor: 是否禁用 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(79, 70, 229, 0.08)',
          borderRadius: '10px',
          border: `1px solid ${是否禁用 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(79, 70, 229, 0.2)'}`,
          transition: 'all 0.2s',
          opacity: 是否禁用 ? '0.5' : '1',
        },
      })
      卡片.onmouseenter = (): void => {
        卡片.style.borderColor = 是否禁用 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(99, 102, 241, 0.4)'
      }
      卡片.onmouseleave = (): void => {
        卡片.style.borderColor = 是否禁用 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(79, 70, 229, 0.2)'
      }

      // 序号
      let 序号 = 创建元素('div', {
        textContent: `${索引 + 1}`,
        style: {
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: '#9ca3af',
          fontSize: '11px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: '0',
        },
      })

      // 行为标签
      let 行为颜色 = 规则.行为 === '去除' ? '#ef4444' : '#22c55e'
      let 行为标签 = 创建元素('div', {
        textContent: 规则.行为,
        style: {
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: `${行为颜色}20`,
          color: 行为颜色,
          fontSize: '11px',
          fontWeight: '600',
          flexShrink: '0',
        },
      })

      // 信息区
      let 信息区 = 创建元素('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1', minWidth: '0' },
      })
      let 标题行 = 创建元素('div', {
        textContent: 展示信息.标题,
        style: {
          color: '#e5e7eb',
          fontSize: '13px',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      })
      let 描述行 = 创建元素('div', { textContent: 展示信息.描述, style: { color: '#6b7280', fontSize: '11px' } })
      信息区.append(标题行, 描述行)

      // 操作按钮区
      let 操作区 = 创建元素('div', { style: { display: 'flex', gap: '4px', flexShrink: '0' } })

      // 上移
      if (索引 > 0) {
        let 上移按钮 = 创建小按钮('▲', () => {
          let 临时 = 当前规则列表[索引 - 1]
          let 当前 = 当前规则列表[索引]
          if (临时 !== undefined && 当前 !== undefined) {
            当前规则列表[索引 - 1] = 当前
            当前规则列表[索引] = 临时
          }
          渲染列表()
          规则变化时(当前规则列表)
        })
        操作区.append(上移按钮)
      }

      // 下移
      if (索引 < 当前规则列表.length - 1) {
        let 下移按钮 = 创建小按钮('▼', () => {
          let 临时 = 当前规则列表[索引 + 1]
          let 当前 = 当前规则列表[索引]
          if (临时 !== undefined && 当前 !== undefined) {
            当前规则列表[索引 + 1] = 当前
            当前规则列表[索引] = 临时
          }
          渲染列表()
          规则变化时(当前规则列表)
        })
        操作区.append(下移按钮)
      }

      // 编辑
      let 编辑按钮 = 创建小按钮('✏️', async () => {
        await 打开规则编辑模态框(规则, (新规则) => {
          当前规则列表[索引] = 新规则
          渲染列表()
          规则变化时(当前规则列表)
        })
      })
      操作区.append(编辑按钮)

      // 删除
      let 删除按钮 = 创建小按钮('🗑️', () => {
        当前规则列表.splice(索引, 1)
        渲染列表()
        规则变化时(当前规则列表)
      })
      删除按钮.style.color = '#ef4444'
      操作区.append(删除按钮)

      卡片.append(序号, 行为标签, 信息区, 操作区)
      列表容器.append(卡片)
    })
  }

  面板容器.append(头部, 列表容器)
  渲染列表()

  return {
    面板元素: 面板容器,
    获取规则列表: (): 裁剪规则[] => 当前规则列表,
    设置规则列表: (列表: 裁剪规则[]): void => {
      当前规则列表 = 列表
      渲染列表()
    },
  }
}

function 创建小按钮(文本: string, 点击回调: () => void | Promise<void>): HTMLButtonElement {
  let 按钮 = 创建元素('button', {
    textContent: 文本,
    style: {
      width: '28px',
      height: '28px',
      padding: '0',
      backgroundColor: 'transparent',
      color: '#9ca3af',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s',
      outline: 'none',
    },
  })
  按钮.onmouseenter = (): void => {
    按钮.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
    按钮.style.borderColor = 'rgba(255, 255, 255, 0.2)'
  }
  按钮.onmouseleave = (): void => {
    按钮.style.backgroundColor = 'transparent'
    按钮.style.borderColor = 'rgba(255, 255, 255, 0.1)'
  }
  按钮.onclick = (): void => {
    void 点击回调()
  }
  return 按钮
}
