// 自研 SVG 域图标集 —— 24 网格 / 1.6 描边 / 圆角端点，与 lucide 同描边语言
import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base(props: IconProps) {
  const { size = 18, ...rest } = props
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  }
}

/** 驾驶舱：雷达扫描 */
export const IconCockpit = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.6" opacity=".45" />
    <path d="M12 3.5v3.2M12 17.3v3.2M3.5 12h3.2M17.3 12h3.2" opacity=".45" />
    <path d="M12 12l5.4-3.6" />
    <circle cx="15.2" cy="14.4" r="1.15" fill="currentColor" stroke="none" />
  </svg>
)

/** 项目台账：行式清单 */
export const IconLedger = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.4" />
    <path d="M7.4 8.6h.01M10.6 8.6H17M7.4 12h.01M10.6 12H17M7.4 15.4h.01M10.6 15.4h13.4" />
  </svg>
)

/** 项目申报：文件上行 */
export const IconDeclare = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13.6 3.5H7A1.8 1.8 0 0 0 5.2 5.3v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V8.7z" />
    <path d="M13.6 3.5v5.2h5.2" />
    <path d="M12 16.6v-5M9.8 13.7 12 11.5l2.2 2.2" />
  </svg>
)

/** 里程碑：旗标节点 */
export const IconMilestone = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.5 21V4" />
    <path d="M6.5 4.8c2.2-1.4 4.4-1.4 6.6 0 2 1.3 4 1.3 5.4.5v7.4c-1.4.8-3.4.8-5.4-.5-2.2-1.4-4.4-1.4-6.6 0" />
    <circle cx="6.5" cy="21" r="0.01" />
  </svg>
)

/** 计划管理：核对清单 */
export const IconPlan = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="3.8" width="16" height="16.4" rx="2.4" />
    <path d="M7.4 9.2l1.5 1.5 2.6-2.9" />
    <path d="M13.8 9.4H17" />
    <path d="M7.4 15.2l1.5 1.5 2.6-2.9" />
    <path d="M13.8 15.4H17" />
  </svg>
)

/** 经费：¥ 圆标 */
export const IconFunds = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9 7.6l3 4 3-4M12 11.6V17M9.6 13.4h4.8M9.6 15.6h4.8" />
  </svg>
)

/** 验收：盾形核验 */
export const IconAccept = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.2 19 6v5.4c0 4.5-3 7.8-7 9.4-4-1.6-7-4.9-7-9.4V6z" />
    <path d="M9 11.8l2.1 2.2 3.9-4.4" />
  </svg>
)

/** 交付物：立方体 */
export const IconDeliverable = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.3 20 7.6v8.8l-8 4.3-8-4.3V7.6z" />
    <path d="M4.4 7.8 12 12l7.6-4.2M12 12v8.4" />
  </svg>
)

/** 成果转化：循环跃迁 */
export const IconTransform = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.8 3.6v3.6h-3.6" />
    <path d="m10.4 12.7 1.6 1.6 3-3.4" />
  </svg>
)

/** 协作单位：结对节点 */
export const IconCollab = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8.2" cy="9" r="3.1" />
    <circle cx="16.4" cy="13.6" r="2.5" opacity=".7" />
    <path d="M3.6 19.4c.6-3 2.4-4.6 4.6-4.6 2.3 0 4 1.6 4.6 4.6" />
    <path d="M14 19.4c.4-1.9 1.4-3 2.9-3s2.5 1.1 2.9 3" opacity=".7" />
  </svg>
)

/** 后评价：档案星评 */
export const IconPostEval = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 3.6h6M8 3.6A1.9 1.9 0 0 0 6 5.5v13a1.9 1.9 0 0 0 1.9 1.9h8.2A1.9 1.9 0 0 0 18 18.5v-13a1.9 1.9 0 0 0-1.9-1.9" />
    <path d="m12 9.2 1.1 2.2 2.4.4-1.7 1.7.4 2.4L12 14.8l-2.2 1.1.4-2.4-1.7-1.7 2.4-.4z" />
  </svg>
)

/** 预警：三角告警 */
export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10.5 4.4 3.6 16.8a1.7 1.7 0 0 0 1.5 2.6h13.8a1.7 1.7 0 0 0 1.5-2.6L13.5 4.4a1.7 1.7 0 0 0-3 0z" />
    <path d="M12 9.4v4M12 16.4h.01" />
  </svg>
)

/** 变更：双向切换 */
export const IconChange = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M16.4 4.6 20 8.2l-3.6 3.6" />
    <path d="M20 8.2H7.6a3.6 3.6 0 0 0-3.6 3.6" />
    <path d="M7.6 19.4 4 15.8l3.6-3.6" />
    <path d="M4 15.8h12.4a3.6 3.6 0 0 0 3.6-3.6" />
  </svg>
)

/** 评审：文件核签 */
export const IconReview = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.5 3.5H7A1.8 1.8 0 0 0 5.2 5.3v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V7.8z" />
    <path d="M14.5 3.5v4.3h4.3" />
    <circle cx="11" cy="13.4" r="2.6" />
    <path d="m13 15.4 2.6 2.6" />
  </svg>
)

/** 配置中心：调节器 */
export const IconAdmin = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5.4 6.8h6.2M15.6 6.8h3M5.4 12h3M12.4 12h6.2M5.4 17.2h9.4M18.8 17.2h-1" />
    <circle cx="13.8" cy="6.8" r="1.9" />
    <circle cx="10.4" cy="12" r="1.9" />
    <circle cx="16" cy="17.2" r="1.9" />
  </svg>
)

/** 审计日志：卷宗轨迹 */
export const IconAudit = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M17.8 20.5H7.2A2.2 2.2 0 0 1 5 18.3V5.7a2.2 2.2 0 0 1 2.2-2.2h7.4L19 7.9v10.4a2.2 2.2 0 0 1-1.2 2.2z" />
    <path d="M8.4 9h4M8.4 12.4h7.2M8.4 15.8h7.2" />
    <circle cx="16.6" cy="18" r="0.01" />
  </svg>
)

/** 流程模板：节点链 */
export const IconFlow = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.4" y="4" width="6" height="4.6" rx="1.4" />
    <rect x="14.6" y="9.7" width="6" height="4.6" rx="1.4" />
    <rect x="3.4" y="15.4" width="6" height="4.6" rx="1.4" />
    <path d="M9.4 6.3h4.2a2 2 0 0 1 2 2v1.4M14.6 12h-3.2a2 2 0 0 0-2 2v1.4" />
  </svg>
)

/** 承担单位：厂所 */
export const IconUnit = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20.4V9.6l5.6-3.2v14M9.6 9.9 15 6.7v13.7M15 10l5 2.9v7.5" />
    <path d="M3 20.4h18" />
  </svg>
)

/** 总师：罗盘 */
export const IconChief = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m14.8 9.2-1.7 4.5-4.5 1.7 1.7-4.5z" />
    <circle cx="12" cy="12" r="0.01" />
  </svg>
)

/** 工作台：格间 */
export const IconWorkbench = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.8" y="3.8" width="7.2" height="9.4" rx="1.6" />
    <rect x="13.2" y="3.8" width="7" height="5.4" rx="1.6" />
    <rect x="13.2" y="11.4" width="7" height="8.8" rx="1.6" />
    <rect x="3.8" y="15.4" width="7.2" height="4.8" rx="1.6" />
  </svg>
)

/** 拨付管控：金库柱廊 */
export const IconPool = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m12 3.4 8.6 4.4H3.4z" />
    <path d="M5.4 7.8v8M9.8 7.8v8M14.2 7.8v8M18.6 7.8v8" />
    <path d="M3.4 18.6h17.2M4.6 15.8h14.8" />
  </svg>
)

/** 渠道：航线网络 */
export const IconChannel = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="5.6" cy="6" r="2.1" />
    <circle cx="18.4" cy="6.6" r="2.1" />
    <circle cx="7" cy="18" r="2.1" />
    <circle cx="17" cy="16.6" r="2.1" />
    <path d="M7.6 6.2 16.3 6.5M6.2 8 6.8 15.9M8.9 17.4l6-0.5M16.9 8.6l.1 5.9M7.4 7.6l8.3 7.4" opacity=".6" />
  </svg>
)
