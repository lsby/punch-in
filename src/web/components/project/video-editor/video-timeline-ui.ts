import { 创建元素 } from '../../../global/tools/create-element'

export type 时间轴UI元素 = {
  容器: HTMLElement
  轨道容器: HTMLElement
  内容层: HTMLElement
  交互层: HTMLElement
  画布容器: HTMLElement
  刻度尺画布: HTMLCanvasElement
  波形画布: HTMLCanvasElement
  播放头元素: HTMLElement
  波形加载遮罩: HTMLElement
  预览窗: HTMLElement
  预览画布: HTMLCanvasElement
  预览时间标签: HTMLElement
}

export function 构建时间轴UI(shadow: ShadowRoot): 时间轴UI元素 {
  let 容器 = 创建元素('div', {
    style: {
      width: '100%',
      height: '100%',
      backgroundColor: '#16191d',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #333',
      borderRadius: '12px',
      fontFamily: "'Inter', sans-serif",
      userSelect: 'none',
      webkitUserSelect: 'none',
      position: 'relative',
    },
  })

  let 轨道容器 = 创建元素('div', {
    style: {
      flex: '1',
      width: '100%',
      position: 'relative',
      overflowX: 'auto',
      overflowY: 'hidden',
      backgroundColor: '#0f1115',
      backgroundImage:
        'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
      backgroundSize: '20px 20px',
    },
  })

  let 内容层 = 创建元素('div', { style: { position: 'absolute', top: '0', left: '0', height: '100%', width: '0px' } })

  let 交互层 = 创建元素('div', {
    style: {
      position: 'absolute',
      top: '32px',
      left: '0',
      height: 'calc(100% - 32px)',
      width: '0px',
      cursor: 'pointer',
    },
  })

  let 画布容器 = 创建元素('div', {
    style: {
      position: 'sticky',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'none',
    },
  })

  let 刻度尺画布 = 创建元素('canvas', {
    style: { width: '100%', height: '32px', borderBottom: '1px solid #333', backgroundColor: '#1a1e23' },
  })

  let 波形包裹器 = 创建元素('div', { style: { flex: '1', position: 'relative', width: '100%' } })
  let 波形画布 = 创建元素('canvas', {
    style: { width: '100%', height: '100%', backgroundColor: 'rgba(79, 70, 229, 0.02)' },
  })

  let 播放头元素 = 创建元素('div', {
    style: {
      position: 'absolute',
      top: '0',
      bottom: '0',
      width: '2px',
      left: '-1px',
      transform: 'translateX(0px)',
      zIndex: '10',
      pointerEvents: 'none',
    },
  })

  let 播放头线 = 创建元素('div', {
    style: { width: '100%', height: '100%', backgroundColor: '#ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)' },
  })

  let 播放头顶 = 创建元素('div', {
    style: {
      position: 'absolute',
      top: '0',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '12px',
      height: '12px',
      backgroundColor: '#ef4444',
      clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)',
    },
  })

  播放头元素.append(播放头线, 播放头顶)

  波形包裹器.append(波形画布, 播放头元素)
  画布容器.append(刻度尺画布, 波形包裹器)

  内容层.append(交互层)
  轨道容器.append(内容层, 画布容器)

  let 波形加载遮罩 = 创建元素('div', {
    style: {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(15, 17, 21, 0.9)',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1000',
      backdropFilter: 'blur(8px)',
      color: '#818cf8',
      gap: '12px',
      fontSize: '14px',
      fontWeight: '500',
      borderRadius: '12px',
    },
  })

  let 加载动画 = 创建元素('div', {
    style: {
      width: '24px',
      height: '24px',
      border: '2px solid rgba(129, 140, 248, 0.1)',
      borderTopColor: '#818cf8',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
  })

  let 加载文字 = 创建元素('span', { textContent: '正在解析音频波形...' })
  波形加载遮罩.append(加载动画, 加载文字)

  let 全局样式 = 创建元素('style', {
    textContent: `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      ::-webkit-scrollbar {
        height: 10px;
        width: 10px;
      }
      ::-webkit-scrollbar-track {
        background: #0f1115;
        border-top: 1px solid #1f2228;
      }
      ::-webkit-scrollbar-thumb {
        background: #3a3f4a;
        border-radius: 5px;
        border: 2px solid #0f1115;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #4f5665;
      }
    `,
  })

  shadow.append(全局样式)

  let 预览窗 = 创建元素('div', {
    style: {
      position: 'absolute',
      bottom: 'calc(100% + 12px)',
      left: '0',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      pointerEvents: 'none',
      zIndex: '1000',
      transform: 'translateX(-50%)',
    },
  })

  let 预览框 = 创建元素('div', {
    style: {
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(12px)',
      position: 'relative',
      width: '160px',
      height: '90px',
    },
  })

  let 预览画布 = 创建元素('canvas', {
    width: 160,
    height: 90,
    style: { width: '100%', height: '100%', display: 'block' },
  })

  let 预览时间标签 = 创建元素('div', {
    style: {
      position: 'absolute',
      bottom: '6px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#fff',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 'bold',
      letterSpacing: '0.5px',
    },
  })

  let 预览箭头 = 创建元素('div', {
    style: {
      width: '0',
      height: '0',
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
      borderTop: '6px solid #fff',
    },
  })

  预览框.append(预览画布, 预览时间标签)
  预览窗.append(预览框, 预览箭头)

  容器.append(轨道容器, 波形加载遮罩, 预览窗)
  shadow.append(容器)

  return {
    容器,
    轨道容器,
    内容层,
    交互层,
    画布容器,
    刻度尺画布,
    波形画布,
    播放头元素,
    波形加载遮罩,
    预览窗,
    预览画布,
    预览时间标签,
  }
}
