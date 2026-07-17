import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, ChevronRight } from 'lucide-react'
import { useSession, ROLE_LABEL, ROLE_HOME } from '../../store/session'
import type { User } from '../../store/session'
import { api } from '../../api/client'
import { Logo } from '../art'
import { StatusDot } from '../ui'
import {
  IconCockpit, IconLedger, IconDeclare, IconMilestone, IconPlan, IconFunds, IconAlert,
  IconChange, IconReview, IconAdmin, IconWorkbench, IconPool, IconCollab, IconAccept, IconTransform,
} from '../icons'

interface NavItem { to: string; label: string; icon: ReactNode }

const NAVS: Record<User['role'], { group: string; items: NavItem[] }[]> = {
  leader: [
    { group: '决策查看', items: [
      { to: '/cockpit', label: '可视化驾驶舱', icon: <IconCockpit /> },
      { to: '/projects', label: '项目台账', icon: <IconLedger /> },
      { to: '/transformations', label: '成果转化台账', icon: <IconTransform /> },
    ]},
  ],
  mgmt: [
    { group: '总部统筹', items: [
      { to: '/cockpit', label: '可视化驾驶舱', icon: <IconCockpit /> },
      { to: '/projects', label: '项目台账', icon: <IconLedger /> },
      { to: '/transformations', label: '成果转化台账', icon: <IconTransform /> },
      { to: '/alerts', label: '预警中心', icon: <IconAlert /> },
    ]},
    { group: '管控闭环', items: [
      { to: '/approvals', label: '审批中心', icon: <IconAccept /> },
      { to: '/evaluations', label: '协作评价与黑名单', icon: <IconCollab /> },
      { to: '/form-maintenance', label: '表单维护', icon: <IconDeclare /> },
    ]},
  ],
  team: [
    { group: '我的科研', items: [
      { to: '/workbench', label: '工作台', icon: <IconWorkbench /> },
      { to: '/projects', label: '我的项目', icon: <IconLedger /> },
      { to: '/alerts', label: '我的预警', icon: <IconAlert /> },
    ]},
    { group: '业务办理', items: [
      { to: '/declare', label: '项目申报', icon: <IconDeclare /> },
      { to: '/milestones', label: '里程碑填报', icon: <IconMilestone /> },
      { to: '/plans', label: '计划管理', icon: <IconPlan /> },
      { to: '/assessments', label: '评估检查', icon: <IconReview /> },
      { to: '/changes', label: '项目变更', icon: <IconChange /> },
    ]},
  ],
  chief: [
    { group: '技术把关', items: [
      { to: '/review', label: '评审工作台', icon: <IconReview /> },
      { to: '/projects', label: '经手项目', icon: <IconLedger /> },
      { to: '/alerts', label: '风险关注', icon: <IconAlert /> },
    ]},
  ],
  finance: [
    { group: '经费管控', items: [
      { to: '/finance', label: '经费执行台账', icon: <IconFunds /> },
      { to: '/funding', label: '总部拨付管控', icon: <IconPool /> },
      { to: '/projects', label: '本单位项目', icon: <IconLedger /> },
    ]},
  ],
  admin: [
    { group: '平台运维', items: [
      { to: '/admin', label: '配置中心', icon: <IconAdmin /> },
      { to: '/projects', label: '项目台账（只读）', icon: <IconLedger /> },
      { to: '/form-maintenance', label: '表单维护', icon: <IconDeclare /> },
    ]},
  ],
}

const TITLES: Record<string, string> = {
  '/cockpit': '可视化驾驶舱', '/projects': '项目台账', '/approvals': '审批中心', '/alerts': '预警中心',
  '/evaluations': '协作单位评价与黑名单', '/transformations': '成果转化台账', '/transition-tool': '表单维护', '/form-maintenance': '表单维护', '/workbench': '工作台',
  '/declare': '项目申报', '/milestones': '里程碑填报', '/plans': '计划管理', '/changes': '项目变更', '/assessments': '评估检查',
  '/review': '评审工作台', '/finance': '经费执行台账', '/funding': '总部经费拨付管控', '/admin': '配置中心',
}

interface AlertRow { id: number; level: 'red' | 'yellow'; title: string; pname?: string; read: number }

export default function Shell() {
  const { user, boot, logout } = useSession()
  const nav = useNavigate()
  const loc = useLocation()
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    api.get<AlertRow[]>('/alerts').then(setAlerts).catch(() => {})
  }, [user, loc.pathname])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const groups = useMemo(() => (user ? NAVS[user.role] : []), [user])
  if (!user) return null

  const title = TITLES[loc.pathname] || (loc.pathname.startsWith('/projects/') ? '项目全生命周期详情' : '')
  const redCount = alerts.filter((a) => a.level === 'red').length
  const yellowCount = alerts.filter((a) => a.level === 'yellow').length

  return (
    <div className="h-full flex">
      {/* 侧栏 */}
      <aside className="w-[228px] shrink-0 flex flex-col border-r border-line bg-night2">
        <div className="flex items-center gap-2.5 px-4 h-[60px] hairline-b">
          <Logo size={30} />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-wide">科研项目管理平台</div>
            <div className="text-[9.5px] text-faint tracking-[0.18em]">SRPM · DEMO</div>
          </div>
        </div>
        <nav className="grow py-3 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.group} className="mb-4">
              <div className="px-5 pb-1.5 text-[10.5px] tracking-[0.2em] text-faint">{g.group}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  {it.icon}<span>{it.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-line">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold bg-[rgba(56,189,248,0.14)] text-accent border border-[rgba(56,189,248,0.3)]">
              {user.name.slice(0, 1)}
            </div>
            <div className="min-w-0 grow leading-tight">
              <div className="text-[12.5px] font-medium truncate">{user.name}</div>
              <div className="text-[10.5px] text-faint truncate">{ROLE_LABEL[user.role]}</div>
            </div>
            <button aria-label="退出登录" onClick={() => { logout(); nav('/login') }}
              className="p-1.5 rounded-md text-dim hover:text-sred hover:bg-[rgba(248,113,113,0.1)] cursor-pointer transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="grow min-w-0 flex flex-col">
        <header className="h-[60px] shrink-0 flex items-center justify-between px-6 hairline-b bg-[rgba(13,20,38,0.7)] backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="text-faint text-[12px] font-normal">{ROLE_LABEL[user.role]}</span>
            <ChevronRight size={13} className="text-faint" />
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 text-[11.5px] text-faint num">
              <span>{boot?.today?.replace(/-/g, '.')}</span>
              <span className="w-px h-3.5 bg-line2" />
              <span className="flex items-center gap-1.5"><StatusDot color="red" pulse />逾期 {redCount}</span>
              <span className="flex items-center gap-1.5"><StatusDot color="yellow" />临期 {yellowCount}</span>
            </div>
            <div className="relative" ref={bellRef}>
              <button aria-label="预警通知" onClick={() => setBellOpen((v) => !v)}
                className="relative p-2 rounded-lg text-dim hover:text-ink hover:bg-[rgba(148,163,184,0.09)] cursor-pointer transition-colors">
                <Bell size={17} />
                {redCount + yellowCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-sred text-[9.5px] text-[#1A0505] font-bold flex items-center justify-center num">
                    {redCount + yellowCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-11 w-[380px] card fade-up shadow-2xl z-40" style={{ background: '#131D33' }}>
                  <div className="px-4 py-2.5 hairline-b flex items-center justify-between">
                    <span className="text-[12.5px] font-medium">预警通知</span>
                    <span className="text-[10.5px] text-faint">推送渠道：站内 · 企业邮箱 · 蓝信</span>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {alerts.slice(0, 8).map((a) => (
                      <div key={a.id} className="px-4 py-2.5 hairline-b flex gap-2.5 items-start hover:bg-[rgba(56,189,248,0.04)]">
                        <span className="mt-1"><StatusDot color={a.level} pulse={a.level === 'red'} /></span>
                        <span className="text-[12px] leading-5 text-ink">{a.title}</span>
                      </div>
                    ))}
                    {alerts.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-faint">暂无预警</div>}
                  </div>
                  <button className="w-full py-2.5 text-[12px] text-accent hover:bg-[rgba(56,189,248,0.06)] cursor-pointer"
                    onClick={() => { setBellOpen(false); nav('/alerts') }}>
                    进入预警中心
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="grow overflow-y-auto blueprint-bg">
          <div className="p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export function useDefaultHome() {
  const { user } = useSession()
  return user ? ROLE_HOME[user.role] : '/login'
}
