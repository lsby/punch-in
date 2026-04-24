import { 关闭模态框, 显示模态框 } from '../../../global/manager/modal-manager'
import { 创建元素 } from '../../../global/tools/create-element'
import { 裁剪规则 } from './video-editor-types'

export async function 打开规则编辑模态框(
  已有规则: 裁剪规则 | undefined,
  确认回调: (规则: 裁剪规则) => void,
): Promise<void> {
  let 容器 = 创建元素('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '10px 0',
      color: '#fff',
      fontSize: '14px',
    },
  })

  let 创建分组 = (标题: string): { 容器: HTMLDivElement; 内容区: HTMLDivElement } => {
    let 分组容器 = 创建元素('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: '12px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      },
    })
    let 分组标题 = 创建元素('div', {
      textContent: 标题,
      style: { fontSize: '13px', fontWeight: 'bold', color: '#818cf8', marginBottom: '4px' },
    })
    let 内容区 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } })
    分组容器.append(分组标题, 内容区)
    return { 容器: 分组容器, 内容区: 内容区 }
  }

  // --- 1. 选择视频部分的规则描述 ---
  let 选择部分分组 = 创建分组('选择视频部分 (基于音频和时长)')

  let 音量行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  音量行.append(创建元素('span', { textContent: '音量阈值:', style: { width: '70px' } }))
  let 音量符号 = 创建元素('select', {
    style: {
      padding: '6px',
      borderRadius: '6px',
      background: '#2d333b',
      color: '#fff',
      border: '1px solid #444',
      flex: '1',
    },
  })
  音量符号.innerHTML = '<option value="<">小于</option><option value=">">大于</option>'
  if (已有规则 !== undefined) 音量符号.value = 已有规则.音量条件.符号
  let 音量值 = 创建元素('input', {
    type: 'number',
    value: 已有规则 !== undefined ? (已有规则.音量条件.值 * 100).toString() : '10',
    style: {
      width: '60px',
      padding: '6px',
      borderRadius: '6px',
      background: '#2d333b',
      color: '#fff',
      border: '1px solid #444',
    },
  })
  音量行.append(音量符号, 音量值, 创建元素('span', { textContent: '%' }))

  let 持续时间行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  持续时间行.append(创建元素('span', { textContent: '持续时间:', style: { width: '70px' } }))
  let 持续时间符号 = 创建元素('select', {
    style: {
      padding: '6px',
      borderRadius: '6px',
      background: '#2d333b',
      color: '#fff',
      border: '1px solid #444',
      flex: '1',
    },
  })
  持续时间符号.innerHTML = '<option value=">">大于</option><option value="<">小于</option>'
  if (已有规则 !== undefined) 持续时间符号.value = 已有规则.持续时间条件.符号
  let 持续时间值 = 创建元素('input', {
    type: 'number',
    value: 已有规则 !== undefined ? 已有规则.持续时间条件.值.toString() : '1',
    style: {
      width: '60px',
      padding: '6px',
      borderRadius: '6px',
      background: '#2d333b',
      color: '#fff',
      border: '1px solid #444',
    },
  })
  持续时间行.append(持续时间符号, 持续时间值, 创建元素('span', { textContent: '秒' }))

  选择部分分组.内容区.append(音量行, 持续时间行)

  // --- 2. 区域微调 ---
  let 微调分组 = 创建分组('区域微调 (二次处理)')

  let 微调行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  微调行.append(创建元素('span', { textContent: '模式:', style: { width: '70px' } }))
  let 微调符号 = 创建元素('select', {
    style: {
      padding: '6px',
      borderRadius: '6px',
      background: '#2d333b',
      color: '#fff',
      border: '1px solid #444',
      flex: '1',
    },
  })
  微调符号.innerHTML = '<option value="内缩">内缩</option><option value="外扩">外扩</option>'
  if (已有规则 !== undefined) 微调符号.value = 已有规则.区域微调.类型
  let 微调值 = 创建元素('input', {
    type: 'number',
    value: 已有规则 !== undefined ? 已有规则.区域微调.值.toString() : '0.5',
    style: {
      width: '60px',
      padding: '6px',
      borderRadius: '6px',
      background: '#2d333b',
      color: '#fff',
      border: '1px solid #444',
    },
  })
  微调行.append(微调符号, 微调值, 创建元素('span', { textContent: '秒' }))

  微调分组.内容区.append(微调行)

  // --- 3. 行为 ---
  let 行为分组 = 创建分组('行为 (最终操作)')

  let 行为行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  行为行.append(创建元素('span', { textContent: '操作类型:', style: { width: '70px' } }))
  let 行为符号 = 创建元素('select', {
    style: {
      padding: '6px',
      borderRadius: '6px',
      background: '#2d333b',
      color: '#fff',
      border: '1px solid #444',
      flex: '1',
    },
  })
  行为符号.innerHTML = '<option value="去除">从时间轴中去除</option><option value="保留">在时间轴中保留</option>'
  if (已有规则 !== undefined) 行为符号.value = 已有规则.行为
  行为行.append(行为符号)

  行为分组.内容区.append(行为行)

  let 确定按钮 = 创建元素('button', {
    textContent: 已有规则 !== undefined ? '保存规则修改' : '确定添加规则',
    style: {
      padding: '12px 16px',
      backgroundColor: '#4f46e5',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      marginTop: '10px',
      fontWeight: 'bold',
      transition: 'all 0.2s',
      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
    },
  })
  确定按钮.onmouseenter = (): void => {
    确定按钮.style.backgroundColor = '#6366f1'
  }
  确定按钮.onmouseleave = (): void => {
    确定按钮.style.backgroundColor = '#4f46e5'
  }

  容器.append(选择部分分组.容器, 微调分组.容器, 行为分组.容器, 确定按钮)

  确定按钮.onclick = (): void => {
    let 新规则: 裁剪规则 = {
      id: 已有规则 !== undefined ? 已有规则.id : Math.random().toString(),
      名称: `音量${音量符号.value}${音量值.value}%，持续${持续时间符号.value}${持续时间值.value}秒`,
      描述: `${微调符号.value}${微调值.value}秒，行为：${行为符号.value.includes('去除') ? '去除' : '保留'}`,
      音量条件: { 符号: 音量符号.value as '>' | '<', 值: parseFloat(音量值.value) / 100 },
      持续时间条件: { 符号: 持续时间符号.value as '>' | '<', 值: parseFloat(持续时间值.value) },
      区域微调: { 类型: 微调符号.value as '外扩' | '内缩', 值: parseFloat(微调值.value) },
      行为: 行为符号.value.includes('去除') ? '去除' : '保留',
    }
    确认回调(新规则)
    void 关闭模态框()
  }

  await 显示模态框(
    { 标题: 已有规则 !== undefined ? '编辑剪辑规则' : '添加剪辑规则', 宽度: '400px', 高度: '520px' },
    容器,
  )
}
