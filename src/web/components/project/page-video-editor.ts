import { 组件基类 } from '../../base/base'
import { 关闭模态框, 显示模态框 } from '../../global/manager/modal-manager'
import { 创建元素 } from '../../global/tools/create-element'
import { 视频预览组件 } from './video-editor/video-preview'
import { 视频时间轴组件 } from './video-editor/video-timeline'

type 裁剪规则 = {
  id: string
  名称: string
  描述: string
  音量条件: { 符号: '>' | '<'; 值: number }
  持续时间条件: { 符号: '>' | '<'; 值: number }
  区域微调: { 类型: '外扩' | '内缩'; 值: number }
  行为: '保留' | '去除'
}

function 合并片段(
  目标: { start: number; end: number }[],
  要添加的: { start: number; end: number }[],
): { start: number; end: number }[] {
  let 所有片段 = [...目标, ...要添加的].sort((a, b) => a.start - b.start)
  if (所有片段.length === 0) return []
  let 元素0 = 所有片段[0]
  if (元素0 === undefined) throw new Error('意外的空值')
  let 结果 = [元素0]
  for (let i = 1; i < 所有片段.length; i++) {
    let 最后一个 = 结果[结果.length - 1]
    if (最后一个 === undefined) throw new Error('意外的空值')
    let 当前 = 所有片段[i]
    if (当前 === undefined) throw new Error('意外的空值')
    if (当前.start <= 最后一个.end) {
      最后一个.end = Math.max(最后一个.end, 当前.end)
    } else {
      结果.push(当前)
    }
  }
  return 结果
}

function 减去片段(
  目标: { start: number; end: number }[],
  要减去的: { start: number; end: number }[],
): { start: number; end: number }[] {
  let 结果: { start: number; end: number }[] = []
  for (let 目标片段 of 目标) {
    let 当前拆分 = [目标片段]
    for (let 减片段 of 要减去的) {
      let 新拆分: { start: number; end: number }[] = []
      for (let 拆分片段 of 当前拆分) {
        if (减片段.end <= 拆分片段.start || 减片段.start >= 拆分片段.end) {
          新拆分.push(拆分片段)
        } else {
          if (拆分片段.start < 减片段.start) {
            新拆分.push({ start: 拆分片段.start, end: 减片段.start })
          }
          if (减片段.end < 拆分片段.end) {
            新拆分.push({ start: 减片段.end, end: 拆分片段.end })
          }
        }
      }
      当前拆分 = 新拆分
    }
    结果.push(...当前拆分)
  }
  return 结果
}

type 发出事件类型 = {}
type 监听事件类型 = {}

export class 视频剪辑页面组件 extends 组件基类<发出事件类型, 监听事件类型> {
  static {
    this.注册组件('lsby-page-video-editor', this)
  }

  private 预览组件: 视频预览组件 | null = null
  private 时间轴组件: 视频时间轴组件 | null = null

  protected override async 当加载时(): Promise<void> {
    this.获得宿主样式().display = 'block'
    this.获得宿主样式().width = '100%'
    this.获得宿主样式().height = '100vh'

    let 容器 = 创建元素('div', {
      style: {
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        padding: '20px',
        boxSizing: 'border-box',
        background: '#121212',
        color: '#fff',
        fontFamily: "'Inter', sans-serif",
        gap: '20px',
      },
    })

    let 左侧主内容 = 创建元素('div', {
      style: {
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        minWidth: '0',
        minHeight: '0',
        overflow: 'hidden',
      },
    })

    this.预览组件 = new 视频预览组件()
    this.时间轴组件 = new 视频时间轴组件()
    this.时间轴组件.style.height = '280px'
    this.时间轴组件.style.flexShrink = '0'

    let 拖拽提示 = 创建元素('div', {
      textContent: '拖入视频文件开始预览',
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed #333',
        borderRadius: '16px',
        color: '#666',
        fontSize: '18px',
        transition: 'all 0.3s',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
      },
    })

    let 预览容器 = 创建元素('div', {
      style: { flex: '1', position: 'relative', minHeight: '0', display: 'flex', flexDirection: 'column' },
    })
    预览容器.append(拖拽提示)

    左侧主内容.append(预览容器, this.时间轴组件)

    // ---------------- 规则面板 ----------------
    let 右侧规则面板 = 创建元素('div', {
      style: {
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1e23',
        borderRadius: '16px',
        padding: '20px',
        gap: '16px',
        border: '1px solid #333',
      },
    })

    let 面板标题 = 创建元素('div', {
      textContent: '粗剪规则',
      style: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#e0e7ff',
        borderBottom: '1px solid #333',
        paddingBottom: '12px',
      },
    })

    let 规则列表容器 = 创建元素('div', {
      style: { flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' },
    })

    let 规则按钮容器 = 创建元素('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' },
    })

    let 添加静音规则按钮 = 创建元素('button', {
      textContent: '+ 添加裁剪规则',
      style: {
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        color: '#818cf8',
        border: '1px dashed #4f46e5',
        cursor: 'pointer',
        fontWeight: '500',
        transition: 'all 0.2s',
      },
    })
    添加静音规则按钮.onmouseenter = (): void => {
      添加静音规则按钮.style.backgroundColor = 'rgba(79, 70, 229, 0.2)'
    }
    添加静音规则按钮.onmouseleave = (): void => {
      添加静音规则按钮.style.backgroundColor = 'rgba(79, 70, 229, 0.1)'
    }

    规则按钮容器.append(添加静音规则按钮)
    右侧规则面板.append(面板标题, 规则列表容器, 规则按钮容器)

    let 当前规则列表: 裁剪规则[] = []
    let 当前排除片段: { start: number; end: number }[] = []

    let 渲染规则列表 = (): void => {
      规则列表容器.innerHTML = ''
      if (当前规则列表.length === 0) {
        规则列表容器.append(
          创建元素('div', {
            textContent: '暂无规则，播放时不会跳过任何片段。',
            style: { color: '#666', fontSize: '14px', textAlign: 'center', marginTop: '20px' },
          }),
        )
      } else {
        当前规则列表.forEach((规则, index) => {
          let 规则项 = 创建元素('div', {
            style: {
              backgroundColor: '#232830',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            },
          })
          let 标题行 = 创建元素('div', {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
          })
          let 标题 = 创建元素('span', {
            textContent: 规则.名称,
            style: { fontWeight: 'bold', color: '#fff', fontSize: '14px' },
          })
          let 上移按钮 = 创建元素('button', {
            textContent: '↑',
            style: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' },
          })
          let 下移按钮 = 创建元素('button', {
            textContent: '↓',
            style: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' },
          })
          let 编辑按钮 = 创建元素('button', {
            textContent: '编辑',
            style: {
              background: 'none',
              border: 'none',
              color: '#60a5fa',
              cursor: 'pointer',
              fontSize: '12px',
              marginLeft: '4px',
              marginRight: '4px',
            },
          })
          let 删除按钮 = 创建元素('button', {
            textContent: '删除',
            style: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' },
          })

          上移按钮.onclick = (): void => {
            if (index > 0) {
              let 当前项 = 当前规则列表[index]
              if (当前项 === undefined) throw new Error('意外的空值')
              let 前一项 = 当前规则列表[index - 1]
              if (前一项 === undefined) throw new Error('意外的空值')
              当前规则列表[index] = 前一项
              当前规则列表[index - 1] = 当前项
              重新计算规则()
            }
          }
          下移按钮.onclick = (): void => {
            if (index < 当前规则列表.length - 1) {
              let 当前项 = 当前规则列表[index]
              if (当前项 === undefined) throw new Error('意外的空值')
              let 后一项 = 当前规则列表[index + 1]
              if (后一项 === undefined) throw new Error('意外的空值')
              当前规则列表[index] = 后一项
              当前规则列表[index + 1] = 当前项
              重新计算规则()
            }
          }
          编辑按钮.onclick = async (): Promise<void> => {
            await 打开规则编辑模态框(规则, (修改后的规则) => {
              当前规则列表[index] = 修改后的规则
              重新计算规则()
            })
          }
          删除按钮.onclick = (): void => {
            当前规则列表.splice(index, 1)
            重新计算规则()
          }

          let 按钮组 = 创建元素('div', { style: { display: 'flex', alignItems: 'center' } })
          按钮组.append(上移按钮, 下移按钮, 编辑按钮, 删除按钮)
          标题行.append(标题, 按钮组)
          let 描述 = 创建元素('span', { textContent: 规则.描述, style: { color: '#888', fontSize: '12px' } })
          规则项.append(标题行, 描述)
          规则列表容器.append(规则项)
        })
      }
    }

    let 重新计算规则 = (): void => {
      当前排除片段 = []
      let 时长 = this.预览组件?.获取视频时长() ?? 0
      let 峰值 = this.时间轴组件?.获取峰值数据()

      if (时长 <= 0 || 峰值 === null || 峰值 === undefined || 当前规则列表.length === 0) {
        this.预览组件?.设置排除片段([])
        this.时间轴组件?.设置排除片段([])
        渲染规则列表()
        return
      }

      let 样本率 = 100 // 当前后端使用100个采样点每秒

      for (let 规则 of 当前规则列表) {
        let 匹配片段: { start: number; end: number }[] = []
        let 当前片段开始 = -1

        // 1. 匹配音量条件
        for (let i = 0; i < 峰值.length; i++) {
          let 当前峰值 = 峰值[i]
          if (当前峰值 === undefined) throw new Error('意外的空值')
          let 满足 = 规则.音量条件.符号 === '<' ? 当前峰值 < 规则.音量条件.值 : 当前峰值 > 规则.音量条件.值

          if (满足) {
            if (当前片段开始 === -1) 当前片段开始 = i
          } else {
            if (当前片段开始 !== -1) {
              匹配片段.push({ start: 当前片段开始 / 样本率, end: i / 样本率 })
              当前片段开始 = -1
            }
          }
        }
        if (当前片段开始 !== -1) {
          匹配片段.push({ start: 当前片段开始 / 样本率, end: 峰值.length / 样本率 })
        }

        // 2. 匹配持续时间条件
        匹配片段 = 匹配片段.filter((p) => {
          let 持续 = p.end - p.start
          return 规则.持续时间条件.符号 === '<' ? 持续 < 规则.持续时间条件.值 : 持续 > 规则.持续时间条件.值
        })

        // 3. 区域微调
        let 微调后片段: { start: number; end: number }[] = []
        let 最大结束时间 = 峰值.length / 样本率
        for (let p of 匹配片段) {
          let s = p.start
          let e = p.end
          if (规则.区域微调.类型 === '外扩') {
            if (s > 0) s -= 规则.区域微调.值
            if (e < 最大结束时间) e += 规则.区域微调.值
          } else {
            if (s > 0) s += 规则.区域微调.值
            if (e < 最大结束时间) e -= 规则.区域微调.值
          }
          s = Math.max(0, s)
          e = Math.min(时长, e)
          if (s < e) {
            微调后片段.push({ start: s, end: e })
          }
        }

        微调后片段 = 合并片段([], 微调后片段)

        // 对微调合并后的最终片段再次应用持续时间条件，过滤掉因为内缩导致变得极小、不符合用户预期的碎片
        微调后片段 = 微调后片段.filter((p) => {
          let 持续 = p.end - p.start
          // 强制过滤掉小于 0.1 秒的极短碎片，这种碎片在播放时会引起频繁 seek 卡顿，且无实际剪辑意义
          if (持续 < 0.1) return false
          return 规则.持续时间条件.符号 === '<' ? 持续 < 规则.持续时间条件.值 : 持续 >= 规则.持续时间条件.值
        })

        // 4. 应用行为
        if (规则.行为 === '去除') {
          当前排除片段 = 合并片段(当前排除片段, 微调后片段)
        } else {
          当前排除片段 = 减去片段(当前排除片段, 微调后片段)
        }
      }

      this.预览组件?.设置排除片段(当前排除片段)
      this.时间轴组件?.设置排除片段(当前排除片段)
      渲染规则列表()
    }

    let 打开规则编辑模态框 = async (
      已有规则: 裁剪规则 | undefined,
      确认回调: (规则: 裁剪规则) => void,
    ): Promise<void> => {
      let 容器 = 创建元素('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '10px 0',
          color: '#fff',
          fontSize: '14px',
        },
      })

      let 音量行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
      音量行.append(创建元素('span', { textContent: '音量:' }))
      let 音量符号 = 创建元素('select', {
        style: { padding: '4px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' },
      })
      音量符号.innerHTML = '<option value="<">小于</option><option value=">">大于</option>'
      if (已有规则 !== undefined) 音量符号.value = 已有规则.音量条件.符号
      let 音量值 = 创建元素('input', {
        type: 'number',
        value: 已有规则 !== undefined ? (已有规则.音量条件.值 * 100).toString() : '10',
        style: {
          width: '60px',
          padding: '4px',
          borderRadius: '4px',
          background: '#333',
          color: '#fff',
          border: '1px solid #555',
        },
      })
      音量行.append(音量符号, 音量值, 创建元素('span', { textContent: '%' }))

      let 持续时间行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
      持续时间行.append(创建元素('span', { textContent: '持续时间:' }))
      let 持续时间符号 = 创建元素('select', {
        style: { padding: '4px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' },
      })
      持续时间符号.innerHTML = '<option value=">">大于</option><option value="<">小于</option>'
      if (已有规则 !== undefined) 持续时间符号.value = 已有规则.持续时间条件.符号
      let 持续时间值 = 创建元素('input', {
        type: 'number',
        value: 已有规则 !== undefined ? 已有规则.持续时间条件.值.toString() : '1',
        style: {
          width: '60px',
          padding: '4px',
          borderRadius: '4px',
          background: '#333',
          color: '#fff',
          border: '1px solid #555',
        },
      })
      持续时间行.append(持续时间符号, 持续时间值, 创建元素('span', { textContent: '秒' }))

      let 微调行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
      微调行.append(创建元素('span', { textContent: '区域微调:' }))
      let 微调符号 = 创建元素('select', {
        style: { padding: '4px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' },
      })
      微调符号.innerHTML = '<option value="内缩">内缩</option><option value="外扩">外扩</option>'
      if (已有规则 !== undefined) 微调符号.value = 已有规则.区域微调.类型
      let 微调值 = 创建元素('input', {
        type: 'number',
        value: 已有规则 !== undefined ? 已有规则.区域微调.值.toString() : '0.5',
        style: {
          width: '60px',
          padding: '4px',
          borderRadius: '4px',
          background: '#333',
          color: '#fff',
          border: '1px solid #555',
        },
      })
      微调行.append(微调符号, 微调值, 创建元素('span', { textContent: '秒' }))

      let 行为行 = 创建元素('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } })
      行为行.append(创建元素('span', { textContent: '行为:' }))
      let 行为符号 = 创建元素('select', {
        style: { padding: '4px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' },
      })
      行为符号.innerHTML = '<option value="去除">去除</option><option value="保留">保留</option>'
      if (已有规则 !== undefined) 行为符号.value = 已有规则.行为
      行为行.append(行为符号)

      let 确定按钮 = 创建元素('button', {
        textContent: 已有规则 !== undefined ? '保存修改' : '确定添加',
        style: {
          padding: '8px 16px',
          backgroundColor: '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '16px',
          fontWeight: 'bold',
        },
      })

      容器.append(音量行, 持续时间行, 微调行, 行为行, 确定按钮)

      确定按钮.onclick = (): void => {
        let 新规则: 裁剪规则 = {
          id: 已有规则 !== undefined ? 已有规则.id : Math.random().toString(),
          名称: `音量${音量符号.value}${音量值.value}%，持续${持续时间符号.value}${持续时间值.value}秒`,
          描述: `${微调符号.value}${微调值.value}秒，行为：${行为符号.value}`,
          音量条件: { 符号: 音量符号.value as '>' | '<', 值: parseFloat(音量值.value) / 100 },
          持续时间条件: { 符号: 持续时间符号.value as '>' | '<', 值: parseFloat(持续时间值.value) },
          区域微调: { 类型: 微调符号.value as '外扩' | '内缩', 值: parseFloat(微调值.value) },
          行为: 行为符号.value as '保留' | '去除',
        }
        确认回调(新规则)
        void 关闭模态框()
      }

      await 显示模态框(
        { 标题: 已有规则 !== undefined ? '编辑剪辑规则' : '添加剪辑规则', 宽度: '360px', 高度: '340px' },
        容器,
      )
    }

    添加静音规则按钮.onclick = async (): Promise<void> => {
      await 打开规则编辑模态框(undefined, (新规则) => {
        当前规则列表.push(新规则)
        重新计算规则()
      })
    }

    渲染规则列表()

    容器.append(左侧主内容, 右侧规则面板)
    this.shadow.append(容器)

    // 拖拽事件
    容器.ondragover = (e: DragEvent): void => {
      e.preventDefault()
      拖拽提示.style.borderColor = '#4f46e5'
      拖拽提示.style.color = '#4f46e5'
      拖拽提示.style.backgroundColor = 'rgba(79, 70, 229, 0.05)'
    }

    容器.ondragleave = (): void => {
      拖拽提示.style.borderColor = '#333'
      拖拽提示.style.color = '#666'
      拖拽提示.style.backgroundColor = 'transparent'
    }

    容器.ondrop = async (e: DragEvent): Promise<void> => {
      e.preventDefault()
      let 文件 = e.dataTransfer?.files[0]
      if (文件 === undefined) throw new Error('意外的空值')
      if (文件.type.startsWith('video/')) {
        let url = URL.createObjectURL(文件)
        let 真实路径 = window.electronAPI.获取文件路径(文件)
        if (this.预览组件 !== null && this.预览组件.parentElement === null) {
          拖拽提示.remove()
          预览容器.append(this.预览组件)
        }
        this.预览组件?.设置视频源(url)
        await this.时间轴组件?.设置资源(url, 文件.name, 真实路径)
        重新计算规则()
      }
    }

    // 事件联动
    this.预览组件.监听发出事件('进度变化', async (e) => {
      this.时间轴组件?.同步进度(e.detail)
    })

    this.时间轴组件.监听发出事件('进度跳转', async (e) => {
      this.预览组件?.跳转(e.detail)
    })
  }
}
