// 手工 SVG 图形资产：平台徽标 / 蓝图飞机 / 雷达扫描 / 生命周期图
const AC = '#38BDF8'

/** 平台徽标 */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="平台徽标">
      <rect x="1" y="1" width="38" height="38" rx="9" fill="url(#lg)" stroke="rgba(148,163,184,0.25)" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0" stopColor="#16213A" />
          <stop offset="1" stopColor="#0B1120" />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="20" rx="14" ry="5.4" stroke={AC} strokeOpacity="0.4" strokeWidth="1" transform="rotate(-24 20 20)" />
      <path d="M20 7.5 L22.7 17.3 L32.5 20 L22.7 22.7 L20 32.5 L17.3 22.7 L7.5 20 L17.3 17.3 Z" fill={AC} />
      <circle cx="20" cy="20" r="2.4" fill="#0B1120" />
      <circle cx="31" cy="12.6" r="1.5" fill={AC} fillOpacity="0.85" />
    </svg>
  )
}

/** 气动研究：二维翼型绕流场 + 压力分布（风洞数据单风格） */
export function ArtAirfoilFlow({ className }: { className?: string }) {
  const MONO = 'JetBrains Mono, Consolas, monospace'
  // 流线：上翼面加速压缩，驻点线止于前缘，尾迹自后缘拖出
  const streams: [string, number, number][] = [
    ['M30,62 C140,62 260,58 340,60 C400,62 460,64 492,64', 0.35, 3.0],
    ['M30,100 C140,100 180,96 215,88 C265,78 320,84 370,102 C430,118 470,114 492,112', 0.5, 2.2],
    ['M30,133 C120,133 152,129 178,119 C218,103 262,99 302,109 C342,119 372,133 402,141 C442,147 472,145 492,143', 0.55, 1.9],
    ['M30,200 C120,200 170,198 215,192 C270,186 330,182 380,186 C440,190 470,192 492,192', 0.5, 2.4],
    ['M30,236 C150,236 300,232 440,230 L492,230', 0.4, 2.8],
    ['M30,268 C180,268 340,266 492,266', 0.3, 3.4],
  ]
  return (
    <svg viewBox="0 0 520 300" fill="none" className={className} aria-label="翼型绕流场分析图">
      <rect x="6" y="6" width="508" height="288" rx="6" stroke={AC} strokeOpacity="0.16" />
      {[[6, 6], [514, 6], [6, 294], [514, 294]].map(([x, y], i) => (
        <path key={i} d={`M${x - 5},${y} H${x + 5} M${x},${y - 5} V${y + 5}`} stroke={AC} strokeOpacity="0.4" strokeWidth="1" />
      ))}
      {/* 坐标网格 */}
      {Array.from({ length: 11 }, (_, i) => 46 + i * 44).map((x) => (
        <line key={`v${x}`} x1={x} y1="34" x2={x} y2="282" stroke={AC} strokeOpacity="0.05" />
      ))}
      {Array.from({ length: 9 }, (_, i) => 34 + i * 31).map((y) => (
        <line key={`h${y}`} x1="18" y1={y} x2="502" y2={y} stroke={AC} strokeOpacity="0.05" />
      ))}
      <text x="20" y="24" fill={AC} fillOpacity="0.55" fontSize="9.5" fontFamily={MONO} letterSpacing="1.5">AERODYNAMICS · AIRFOIL FLOW FIELD</text>
      <text x="500" y="24" textAnchor="end" fill={AC} fillOpacity="0.4" fontSize="9" fontFamily={MONO} letterSpacing="1">M 0.78 · Re 2.4E7 · α 2.5°</text>

      {/* Cp 压力分布（上翼面吸力峰） */}
      <line x1="155" y1="70" x2="375" y2="70" stroke="#34D399" strokeOpacity="0.25" strokeDasharray="3 4" />
      {[[170, 44], [190, 34], [215, 40], [245, 48], [280, 55], [320, 61], [350, 66]].map(([x, y], i) => (
        <line key={`cp${i}`} x1={x} y1="70" x2={x} y2={y} stroke="#34D399" strokeOpacity="0.3" strokeWidth="0.9" />
      ))}
      <path d="M155,70 C165,38 185,28 205,36 C245,50 310,60 375,69" stroke="#34D399" strokeOpacity="0.75" strokeWidth="1.2" />
      <text x="148" y="42" textAnchor="end" fill="#34D399" fillOpacity="0.6" fontSize="8.5" fontFamily={MONO}>-Cp</text>

      {/* 来流速度矢量 */}
      {[100, 168, 236].map((y) => (
        <g key={`a${y}`} stroke={AC} strokeOpacity="0.5" strokeWidth="1.1">
          <line x1="20" y1={y} x2="40" y2={y} />
          <path d={`M36,${y - 3} L41,${y} L36,${y + 3}`} fill="none" />
        </g>
      ))}

      {/* 流线（动画） */}
      {streams.map(([d, op, dur], i) => (
        <path key={i} d={d} stroke={AC} strokeOpacity={op} strokeWidth="1.1" strokeDasharray="7 7"
          style={{ animation: `dashflow ${dur}s linear ${-i * 0.6}s infinite` }} />
      ))}
      {/* 驻点线与尾迹 */}
      <path d="M30,168 C90,168 122,169 150,170" stroke={AC} strokeOpacity="0.55" strokeWidth="1.1" strokeDasharray="7 7"
        style={{ animation: 'dashflow 2.2s linear infinite' }} />
      <path d="M377,152 C420,154 442,148 464,158 C476,163 486,158 494,158" stroke={AC} strokeOpacity="0.45" strokeWidth="1"
        strokeDasharray="4 5" style={{ animation: 'dashflow 1.8s linear infinite' }} />

      {/* 翼型剖面 */}
      <path d="M155,170 C162,148 205,134 250,130 C305,126 348,138 375,152 C340,156 270,160 220,162 C190,163.5 165,167 155,170 Z"
        stroke={AC} strokeOpacity="0.95" strokeWidth="1.5" fill="rgba(56,189,248,0.1)" />
      <line x1="155" y1="170" x2="375" y2="152" stroke={AC} strokeOpacity="0.3" strokeDasharray="5 5" strokeWidth="0.9" />
      <circle cx="155" cy="170" r="1.8" fill={AC} fillOpacity="0.8" />

      <text x="20" y="286" fill={AC} fillOpacity="0.35" fontSize="8.5" fontFamily={MONO} letterSpacing="1.2">WIND TUNNEL DATA SHEET · SRPM-AERO-014</text>
      <text x="500" y="286" textAnchor="end" fill={AC} fillOpacity="0.25" fontSize="8.5" fontFamily={MONO} letterSpacing="1">STREAMLINE + Cp</text>
    </svg>
  )
}

/** 结构研究：翼肋有限元网格 + 分布载荷 + 支撑约束 */
export function ArtFeaMesh({ className }: { className?: string }) {
  const MONO = 'JetBrains Mono, Consolas, monospace'
  const outline = 'M24,158 C34,104 78,70 150,64 C185,61 210,68 220,80 L220,158 Z'
  // 顶缘近似高度（用于竖向网格线）
  const tops: [number, number][] = [[45, 117], [65, 97], [85, 84], [105, 75], [125, 68], [145, 64.5], [165, 65], [185, 69], [205, 76]]
  return (
    <svg viewBox="0 0 250 210" fill="none" className={className} aria-label="翼肋结构有限元分析图">
      <rect x="5" y="5" width="240" height="200" rx="5" stroke={AC} strokeOpacity="0.16" />
      {[[5, 5], [245, 5], [5, 205], [245, 205]].map(([x, y], i) => (
        <path key={i} d={`M${x - 4},${y} H${x + 4} M${x},${y - 4} V${y + 4}`} stroke={AC} strokeOpacity="0.4" strokeWidth="0.9" />
      ))}
      <text x="16" y="21" fill={AC} fillOpacity="0.55" fontSize="8.5" fontFamily={MONO} letterSpacing="1.5">STRUCTURE · FEA</text>
      <text x="234" y="21" textAnchor="end" fill={AC} fillOpacity="0.35" fontSize="7.5" fontFamily={MONO}>TRIA-6</text>

      {/* 变形虚影 */}
      <path d={outline} transform="translate(4,-5)" stroke={AC} strokeOpacity="0.18" strokeWidth="1" strokeDasharray="4 4" />

      {/* 网格：弦向曲线 + 竖向剖线 + 局部对角线 */}
      <g stroke={AC} strokeOpacity="0.17" strokeWidth="0.8">
        <path d="M28,146 C42,102 84,78 150,73 C183,70.5 206,76 216,86" />
        <path d="M32,152 C50,118 92,94 150,88 C180,85 204,90 214,98" />
        <path d="M26,140 L218,140" opacity="0.8" />
        {tops.map(([x, y]) => <line key={x} x1={x} y1="158" x2={x} y2={y} />)}
      </g>
      <g stroke={AC} strokeOpacity="0.13" strokeWidth="0.7">
        {[[45, 117, 65, 97], [85, 84, 105, 75], [125, 68, 145, 88], [165, 65, 185, 90], [65, 140, 85, 122], [105, 140, 125, 122], [145, 140, 165, 122], [185, 140, 205, 122], [45, 158, 65, 140], [125, 158, 145, 140], [185, 158, 205, 140]].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* 节点 */}
      {[[65, 97], [105, 75], [145, 88], [185, 90], [85, 140], [165, 140], [125, 122], [205, 122]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1" fill={AC} fillOpacity="0.5" />
      ))}

      {/* 零件轮廓与减重孔 */}
      <path d={outline} stroke={AC} strokeOpacity="0.95" strokeWidth="1.4" fill="rgba(56,189,248,0.05)" strokeLinejoin="round" />
      <circle cx="95" cy="124" r="15" stroke={AC} strokeOpacity="0.85" strokeWidth="1.1" fill="#0D1426" />
      <circle cx="163" cy="115" r="11" stroke={AC} strokeOpacity="0.85" strokeWidth="1.1" fill="#0D1426" />
      <path d="M95,113 V119 M95,129 V135 M84,124 H90 M100,124 H106" stroke={AC} strokeOpacity="0.35" strokeWidth="0.8" />

      {/* 分布载荷 */}
      {[[70, 76], [105, 62], [140, 52], [175, 54]].map(([x, yTop], i) => (
        <g key={i} stroke={AC} strokeOpacity="0.65" strokeWidth="1">
          <line x1={x} y1={yTop - 18} x2={x} y2={yTop - 4} />
          <path d={`M${x - 2.6},${yTop - 8} L${x},${yTop - 3} L${x + 2.6},${yTop - 8}`} fill="none" />
        </g>
      ))}
      <line x1="62" y1="45" x2="183" y2="33" stroke={AC} strokeOpacity="0.3" strokeWidth="0.8" />
      <text x="190" y="36" fill={AC} fillOpacity="0.45" fontSize="7.5" fontFamily={MONO}>q(x)</text>

      {/* 固支约束 */}
      <line x1="20" y1="158" x2="224" y2="158" stroke={AC} strokeOpacity="0.7" strokeWidth="1.2" />
      {Array.from({ length: 17 }, (_, i) => 26 + i * 12).map((x) => (
        <line key={x} x1={x} y1="158" x2={x - 6} y2="167" stroke={AC} strokeOpacity="0.35" strokeWidth="0.8" />
      ))}

      {/* 应力峰值标记 */}
      <circle cx="108" cy="115" r="4.5" stroke="#FBBF24" strokeOpacity="0.8" strokeWidth="1" />
      <line x1="112" y1="111" x2="124" y2="99" stroke="#FBBF24" strokeOpacity="0.5" strokeWidth="0.8" />
      <text x="126" y="97" fill="#FBBF24" fillOpacity="0.7" fontSize="7.5" fontFamily={MONO}>σmax</text>

      <text x="16" y="196" fill={AC} fillOpacity="0.35" fontSize="7.5" fontFamily={MONO} letterSpacing="1">WING RIB · MESH 12,846 ELEM</text>
    </svg>
  )
}

/** 流体研究：圆柱绕流卡门涡街 */
export function ArtVortexStreet({ className }: { className?: string }) {
  const MONO = 'JetBrains Mono, Consolas, monospace'
  const spiral = 'M13,0 A13,13 0 1 1 -13,0 A9.5,9.5 0 1 0 6.5,0 A5.2,5.2 0 1 1 -3.2,0'
  const vortices: { x: number; y: number; s: number; flip: boolean; dur: number }[] = [
    { x: 104, y: 84, s: 0.8, flip: false, dur: 10 },
    { x: 138, y: 126, s: 0.9, flip: true, dur: 11 },
    { x: 172, y: 80, s: 1.0, flip: false, dur: 12 },
    { x: 206, y: 128, s: 1.05, flip: true, dur: 13 },
    { x: 232, y: 84, s: 0.85, flip: false, dur: 12 },
  ]
  return (
    <svg viewBox="0 0 250 210" fill="none" className={className} aria-label="圆柱绕流卡门涡街示意图">
      <rect x="5" y="5" width="240" height="200" rx="5" stroke={AC} strokeOpacity="0.16" />
      {[[5, 5], [245, 5], [5, 205], [245, 205]].map(([x, y], i) => (
        <path key={i} d={`M${x - 4},${y} H${x + 4} M${x},${y - 4} V${y + 4}`} stroke={AC} strokeOpacity="0.4" strokeWidth="0.9" />
      ))}
      <text x="16" y="21" fill={AC} fillOpacity="0.55" fontSize="8.5" fontFamily={MONO} letterSpacing="1.5">FLUID · VORTEX STREET</text>

      {/* 网格 */}
      {[45, 75, 105, 135, 165].map((y) => (
        <line key={y} x1="14" y1={y} x2="236" y2={y} stroke={AC} strokeOpacity="0.045" />
      ))}

      {/* 来流 */}
      {[85, 105, 125].map((y) => (
        <g key={y} stroke={AC} strokeOpacity="0.5" strokeWidth="1">
          <line x1="14" y1={y} x2="30" y2={y} />
          <path d={`M27,${y - 2.6} L31,${y} L27,${y + 2.6}`} fill="none" />
        </g>
      ))}

      {/* 圆柱体 */}
      <circle cx="55" cy="105" r="15" stroke={AC} strokeOpacity="0.95" strokeWidth="1.4" fill="rgba(56,189,248,0.09)" />
      <path d="M55,100 V110 M50,105 H60" stroke={AC} strokeOpacity="0.4" strokeWidth="0.8" />

      {/* 摆动尾迹中心线 */}
      <path d="M70,105 C92,90 114,120 136,106 C158,92 180,120 202,106 C220,95 232,110 240,104"
        stroke={AC} strokeOpacity="0.32" strokeWidth="1" strokeDasharray="5 5"
        style={{ animation: 'dashflow 2.6s linear infinite' }} />

      {/* 交替脱落的涡（缓慢自旋） */}
      {vortices.map((v, i) => (
        <g key={i} transform={`translate(${v.x},${v.y}) scale(${v.s},${v.flip ? -v.s : v.s})`}>
          <g style={{ animation: `sweep ${v.dur}s linear infinite`, transformOrigin: '0px 0px' }}>
            <path d={spiral} stroke={AC} strokeOpacity={0.5 + v.s * 0.1} strokeWidth={1.1 / v.s} fill="none" strokeLinecap="round" />
          </g>
        </g>
      ))}

      <text x="16" y="196" fill={AC} fillOpacity="0.35" fontSize="7.5" fontFamily={MONO} letterSpacing="1">KARMAN WAKE · St 0.21 · Re 1.2E5</text>
      <text x="234" y="196" textAnchor="end" fill={AC} fillOpacity="0.25" fontSize="7.5" fontFamily={MONO}>CFD-URANS</text>
    </svg>
  )
}

/** 雷达扫描（驾驶舱装饰） */
export function RadarSweep({ size = 168 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <circle cx="100" cy="100" r="88" stroke={AC} strokeOpacity="0.25" />
      <circle cx="100" cy="100" r="62" stroke={AC} strokeOpacity="0.18" />
      <circle cx="100" cy="100" r="36" stroke={AC} strokeOpacity="0.14" />
      <path d="M100,12 V188 M12,100 H188" stroke={AC} strokeOpacity="0.12" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180
        const x1 = 100 + Math.cos(a) * 84, y1 = 100 + Math.sin(a) * 84
        const x2 = 100 + Math.cos(a) * 88, y2 = 100 + Math.sin(a) * 88
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={AC} strokeOpacity="0.4" />
      })}
      <g style={{ animation: 'sweep 5.5s linear infinite', transformOrigin: '100px 100px' }}>
        <path d="M100,100 L100,12 A88,88 0 0 1 143,23 Z" fill="url(#rs)" />
        <line x1="100" y1="100" x2="100" y2="12" stroke={AC} strokeOpacity="0.8" strokeWidth="1.4" />
      </g>
      <defs>
        <linearGradient id="rs" x1="100" y1="12" x2="130" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor={AC} stopOpacity="0.3" />
          <stop offset="1" stopColor={AC} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[[148, 66, '0s'], [66, 128, '1.4s'], [126, 146, '2.6s']].map(([x, y, d], i) => (
        <circle key={i} cx={x as number} cy={y as number} r="2.6" fill={AC}
          style={{ animation: `blip 2.8s ease-in-out ${d} infinite` }} />
      ))}
      <circle cx="100" cy="100" r="3" fill={AC} />
    </svg>
  )
}

/** 全生命周期阶段图 */
const STAGES = ['项目申报', '立项备案', '实施阶段', '项目验收', '成果转化']

export function LifecycleDiagram({ active }: { active: number }) {
  const W = 760, y = 30
  const xs = STAGES.map((_, i) => 64 + i * ((W - 128) / (STAGES.length - 1)))
  return (
    <svg viewBox={`0 0 ${W} 96`} className="w-full" aria-label="项目全生命周期阶段">
      {xs.slice(0, -1).map((x, i) => {
        const done = i < active
        return (
          <line key={i} x1={x + 20} y1={y} x2={xs[i + 1] - 20} y2={y}
            stroke={done ? '#34D399' : 'rgba(148,163,184,0.25)'} strokeWidth="1.5"
            strokeDasharray={done ? undefined : '5 5'} />
        )
      })}
      {xs.map((x, i) => {
        const done = i < active, cur = i === active
        const c = done ? '#34D399' : cur ? AC : 'rgba(148,163,184,0.4)'
        return (
          <g key={i}>
            {cur && (
              <circle cx={x} cy={y} r="15" stroke={AC} strokeOpacity="0.6" fill="none"
                style={{ animation: 'pulseRing 2.2s ease-out infinite', transformOrigin: `${x}px ${y}px` }} />
            )}
            <circle cx={x} cy={y} r="14" stroke={c} strokeWidth="1.6"
              fill={cur ? 'rgba(56,189,248,0.14)' : done ? 'rgba(52,211,153,0.1)' : 'rgba(17,26,46,0.8)'} />
            {done ? (
              <path d={`M${x - 5.5},${y} l3.6,3.8 l7,-7.4`} stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill={c} fontFamily="JetBrains Mono, monospace">{`0${i + 1}`}</text>
            )}
            <text x={x} y={y + 40} textAnchor="middle" fontSize="12.5"
              fill={cur ? '#E2E8F0' : done ? '#94A3B8' : '#5B6B84'} fontWeight={cur ? 600 : 400}>{STAGES[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** 空态插画：小型雷达网格 */
export function EmptyArt({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <circle cx="48" cy="48" r="34" stroke="rgba(148,163,184,0.25)" strokeDasharray="4 5" />
      <circle cx="48" cy="48" r="20" stroke="rgba(148,163,184,0.18)" />
      <path d="M48 14 v10 M48 72 v10 M14 48 h10 M72 48 h10" stroke="rgba(148,163,184,0.25)" />
      <path d="M48,48 L64,36" stroke={AC} strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="48" cy="48" r="2.4" fill={AC} fillOpacity="0.7" />
    </svg>
  )
}
