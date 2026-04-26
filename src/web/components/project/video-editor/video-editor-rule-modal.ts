import { 关闭模态框, 显示模态框 } from '../../../global/manager/modal-manager'
import { 创建元素 } from '../../../global/tools/create-element'
import { 增强样式类型 } from '../../../global/types/style'
import { 裁剪规则 } from './video-editor-types'

export async function 打开规则编辑模态框(
  已有规则: 裁剪规则 | undefined,
  确认回调: (规则: 裁剪规则) => void,
): Promise<void> {
  let 容器 = 创建元素('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      color: '#e5e7eb',
      fontSize: '14px',
    },
  })

  let 输入项样式: 增强样式类型 = {
    padding: '8px 10px',
    borderRadius: '8px',
    background: '#2d333b',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    outline: 'none',
    fontSize: '13px',
    transition: 'border-color 0.2s, background-color 0.2s',
  }

  let 创建分组 = (标题: string): { 容器: HTMLDivElement; 内容区: HTMLDivElement } => {
    let 分组容器 = 创建元素('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      },
    })
    let 分组标题 = 创建元素('div', {
      textContent: 标题,
      style: {
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#818cf8',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      },
    })
    let 内容区 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } })
    分组容器.append(分组标题, 内容区)
    return { 容器: 分组容器, 内容区: 内容区 }
  }

  // --- 0. 状态 ---
  let 状态分组 = 创建分组('基本状态')
  let 启用规则行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  let 规则启用开关 = 创建元素('input', {
    type: 'checkbox',
    checked: 已有规则 !== undefined ? 已有规则.已禁用 !== true : true,
    style: { cursor: 'pointer' },
  })
  启用规则行.append(规则启用开关, 创建元素('span', { textContent: '启用此规则' }))
  状态分组.内容区.append(启用规则行)

  // --- 1. 选择视频部分的规则描述 ---
  let 选择部分分组 = 创建分组('选择描述')

  // 音量行
  let 音量容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } })
  let 音量头部 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  let 音量开关 = 创建元素('input', {
    type: 'checkbox',
    checked: 已有规则 !== undefined ? (已有规则.选择部分.音量阈值?.是否启用 ?? true) : true,
    style: { cursor: 'pointer' },
  })
  音量头部.append(音量开关, 创建元素('span', { textContent: '音量范围:', style: { fontWeight: '500' } }))

  let 音量内容 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '24px' } })
  let 音量类型 = 创建元素('select', { style: { ...输入项样式, flex: '1' } })
  音量类型.innerHTML =
    '<option value="相对峰值百分比">相对峰值百分比</option><option value="分贝强度">分贝强度</option>'
  if (已有规则?.选择部分.音量阈值 !== undefined) 音量类型.value = 已有规则.选择部分.音量阈值.类型

  let 音量最小值 = 创建元素('input', {
    type: 'number',
    value:
      已有规则?.选择部分.音量阈值 !== undefined
        ? 已有规则.选择部分.音量阈值.类型 === '相对峰值百分比'
          ? (已有规则.选择部分.音量阈值.最小值 * 100).toString()
          : 已有规则.选择部分.音量阈值.最小值.toString()
        : '0',
    style: { ...输入项样式, width: '60px' },
  })
  let 音量最大值 = 创建元素('input', {
    type: 'number',
    value:
      已有规则?.选择部分.音量阈值 !== undefined
        ? 已有规则.选择部分.音量阈值.类型 === '相对峰值百分比'
          ? (已有规则.选择部分.音量阈值.最大值 * 100).toString()
          : 已有规则.选择部分.音量阈值.最大值.toString()
        : '5',
    style: { ...输入项样式, width: '60px' },
  })
  let 音量单位 = 创建元素('span', { textContent: 已有规则?.选择部分.音量阈值?.类型 === '分贝强度' ? 'dB' : '%' })

  音量类型.onchange = (): void => {
    音量单位.textContent = 音量类型.value === '分贝强度' ? 'dB' : '%'
    if (音量类型.value === '分贝强度') {
      音量最小值.value = '0'
      音量最大值.value = '30'
    } else {
      音量最小值.value = '0'
      音量最大值.value = '5'
    }
  }

  音量内容.append(音量类型, 音量最小值, 创建元素('span', { textContent: '-' }), 音量最大值, 音量单位)
  音量容器.append(音量头部, 音量内容)

  let 更新音量状态 = (): void => {
    音量类型.disabled = !音量开关.checked
    音量最小值.disabled = !音量开关.checked
    音量最大值.disabled = !音量开关.checked
    音量内容.style.opacity = 音量开关.checked ? '1' : '0.5'
  }
  音量开关.onchange = (): void => 更新音量状态()
  更新音量状态()

  // 持续时间行
  let 持续时间容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } })
  let 持续时间头部 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  let 持续时间开关 = 创建元素('input', {
    type: 'checkbox',
    checked: 已有规则 !== undefined ? (已有规则.选择部分.持续时间?.是否启用 ?? true) : true,
    style: { cursor: 'pointer' },
  })
  持续时间头部.append(持续时间开关, 创建元素('span', { textContent: '持续时间:', style: { fontWeight: '500' } }))

  let 持续时间内容 = 创建元素('div', {
    style: { display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '24px' },
  })
  let 持续时间符号 = 创建元素('select', { style: { ...输入项样式, flex: '1' } })
  持续时间符号.innerHTML = '<option value=">">大于</option><option value="<">小于</option>'
  if (已有规则?.选择部分.持续时间 !== undefined) 持续时间符号.value = 已有规则.选择部分.持续时间.符号
  let 持续时间值 = 创建元素('input', {
    type: 'number',
    value: 已有规则?.选择部分.持续时间 !== undefined ? 已有规则.选择部分.持续时间.值.toString() : '1',
    style: { ...输入项样式, width: '60px' },
  })
  持续时间内容.append(持续时间符号, 持续时间值, 创建元素('span', { textContent: '秒' }))
  持续时间容器.append(持续时间头部, 持续时间内容)

  let 更新持续时间状态 = (): void => {
    持续时间符号.disabled = !持续时间开关.checked
    持续时间值.disabled = !持续时间开关.checked
    持续时间内容.style.opacity = 持续时间开关.checked ? '1' : '0.5'
  }
  持续时间开关.onchange = (): void => 更新持续时间状态()
  更新持续时间状态()

  选择部分分组.内容区.append(音量容器, 持续时间容器)

  // --- 2. 区域微调 ---
  let 微调分组 = 创建分组('区域微调')

  let 微调容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } })
  微调容器.append(创建元素('span', { textContent: '缓冲区域:', style: { fontWeight: '500' } }))
  let 微调内容 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  let 微调符号 = 创建元素('select', { style: { ...输入项样式, flex: '1' } })
  微调符号.innerHTML =
    '<option value="内缩">内缩</option><option value="外扩">外扩</option><option value="不处理">不处理</option>'
  if (已有规则 !== undefined) 微调符号.value = 已有规则.二次处理.区域微调.类型
  let 微调值 = 创建元素('input', {
    type: 'number',
    value: 已有规则 !== undefined ? 已有规则.二次处理.区域微调.值.toString() : '0.5',
    style: { ...输入项样式, width: '60px' },
  })

  let 更新微调状态 = (): void => {
    微调值.disabled = 微调符号.value === '不处理'
    微调值.style.opacity = 微调符号.value === '不处理' ? '0.5' : '1'
  }
  微调符号.onchange = (): void => 更新微调状态()
  更新微调状态()

  微调内容.append(微调符号, 微调值, 创建元素('span', { textContent: '秒' }))
  微调容器.append(微调内容)

  微调分组.内容区.append(微调容器)

  // --- 3. 全局配置 ---
  let 全局配置分组 = 创建分组('全局配置')
  let 过滤容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } })
  过滤容器.append(创建元素('span', { textContent: '最小片段:', style: { fontWeight: '500' } }))
  let 过滤内容 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  let 过滤值 = 创建元素('input', {
    type: 'number',
    value: 已有规则 !== undefined ? 已有规则.二次处理.强制过滤时长.toString() : '0.1',
    step: '0.01',
    min: '0',
    style: { ...输入项样式, width: '100%' },
  })
  过滤内容.append(过滤值, 创建元素('span', { textContent: '秒' }))
  过滤容器.append(过滤内容)

  全局配置分组.内容区.append(过滤容器)

  // --- 4. 行为 ---
  let 行为分组 = 创建分组('行为')

  let 行为容器 = 创建元素('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } })
  行为容器.append(创建元素('span', { textContent: '操作类型:', style: { fontWeight: '500' } }))
  let 行为内容 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
  let 行为符号 = 创建元素('select', { style: { ...输入项样式, flex: '1' } })
  行为符号.innerHTML = '<option value="去除">从时间轴中去除</option><option value="保留">在时间轴中保留</option>'
  if (已有规则 !== undefined) 行为符号.value = 已有规则.行为
  行为内容.append(行为符号)
  行为容器.append(行为内容)

  行为分组.内容区.append(行为容器)

  let 确定按钮 = 创建元素('button', {
    textContent: 已有规则 !== undefined ? '保存规则修改' : '确定添加规则',
    style: {
      padding: '12px 16px',
      backgroundColor: '#4f46e5',
      color: '#fff',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      marginTop: '8px',
      fontWeight: '600',
      transition: 'all 0.2s',
      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
      fontSize: '14px',
    },
  })
  确定按钮.onmouseenter = (): void => {
    确定按钮.style.backgroundColor = '#6366f1'
    确定按钮.style.transform = 'translateY(-1px)'
    确定按钮.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.3)'
  }
  确定按钮.onmouseleave = (): void => {
    确定按钮.style.backgroundColor = '#4f46e5'
    确定按钮.style.transform = 'none'
    确定按钮.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.2)'
  }

  容器.append(状态分组.容器, 全局配置分组.容器, 选择部分分组.容器, 微调分组.容器, 行为分组.容器, 确定按钮)

  确定按钮.onclick = (): void => {
    let 新规则: 裁剪规则 = {
      id: 已有规则 !== undefined ? 已有规则.id : Math.random().toString(),
      已禁用: !规则启用开关.checked,
      选择部分: {
        音量阈值: {
          是否启用: 音量开关.checked,
          类型: 音量类型.value as '相对峰值百分比' | '分贝强度',
          最小值:
            音量类型.value === '相对峰值百分比' ? parseFloat(音量最小值.value) / 100 : parseFloat(音量最小值.value),
          最大值:
            音量类型.value === '相对峰值百分比' ? parseFloat(音量最大值.value) / 100 : parseFloat(音量最大值.value),
        },
        持续时间: {
          是否启用: 持续时间开关.checked,
          符号: 持续时间符号.value as '>' | '<',
          值: parseFloat(持续时间值.value),
        },
      },
      二次处理: {
        区域微调: { 类型: 微调符号.value as '外扩' | '内缩' | '不处理', 值: parseFloat(微调值.value) },
        强制过滤时长: parseFloat(过滤值.value),
      },
      行为: 行为符号.value.includes('去除') ? '去除' : '保留',
    }
    确认回调(新规则)
    void 关闭模态框()
  }

  await 显示模态框(
    { 标题: 已有规则 !== undefined ? '编辑剪辑规则' : '添加剪辑规则', 宽度: '440px', 高度: 'auto', 最大高度: '80vh' },
    容器,
  )
}
