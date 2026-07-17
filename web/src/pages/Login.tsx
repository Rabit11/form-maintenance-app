import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Database, GitBranch, ShieldCheck, Sparkles } from 'lucide-react'
import { useSession, ROLE_HOME, ROLE_LABEL } from '../store/session'
import type { User } from '../store/session'
import { Logo, ArtAirfoilFlow, ArtFeaMesh, ArtVortexStreet } from '../components/art'
import {
  IconAdmin,
  IconChief,
  IconCockpit,
  IconFunds,
  IconTransform,
  IconWorkbench,
} from '../components/icons'

const ROLE_META: Record<User['role'], { icon: ReactNode; desc: string; order: number; accent: string }> = {
  leader: {
    icon: <IconCockpit size={20} />,
    desc: '可视化看板 / 项目台账 / 成果转化台账只读查看',
    order: 1,
    accent: '决策查看',
  },
  mgmt: {
    icon: <IconCockpit size={20} />,
    desc: '总部统筹 / 单位管理 / 计划经费风险 / 成果转化督办',
    order: 2,
    accent: '统筹管理',
  },
  team: {
    icon: <IconWorkbench size={20} />,
    desc: '全周期资料填报 / 节点推进 / 成果转化基础信息更新',
    order: 3,
    accent: '项目填报',
  },
  chief: {
    icon: <IconChief size={20} />,
    desc: '一级/二级总师技术指导、重要节点审核、线上材料评审',
    order: 4,
    accent: '技术复核',
  },
  finance: {
    icon: <IconFunds size={20} />,
    desc: '本单位经费台账查看、经费核对、预算核销、异常监管',
    order: 5,
    accent: '经费管控',
  },
  admin: {
    icon: <IconAdmin size={20} />,
    desc: '人员添加/删除/权限编辑；渠道字典、流程模板、审计日志',
    order: 6,
    accent: '系统超级管理员',
  },
}

const V19_POINTS = [
  { icon: <ShieldCheck size={14} />, text: '领导只读' },
  { icon: <IconTransform size={14} />, text: '成果转化台账' },
  { icon: <Database size={14} />, text: 'V19 字段口径' },
  { icon: <GitBranch size={14} />, text: '表单维护' },
]

export default function Login() {
  const { boot, login } = useSession()
  const nav = useNavigate()

  if (!boot) {
    return (
      <div className="h-full flex items-center justify-center text-faint text-sm blueprint-bg">
        正在连接科研项目管理平台...
      </div>
    )
  }

  const users = [...boot.users].sort((a, b) => ROLE_META[a.role].order - ROLE_META[b.role].order)
  const enabledChannels = boot.channels.filter((x) => x.enabled).length
  const managedUnits = boot.units.filter((x) => x.kind === 'unit').length
  const levels = Array.from(new Set(boot.channels.map((x) => x.level))).length

  return (
    <div className="h-full blueprint-bg overflow-y-auto overflow-x-hidden">
      <div className="min-h-full max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 py-7 sm:py-9 xl:py-10 flex flex-col">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-7 sm:mb-9 xl:mb-10">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={38} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] sm:text-[15px] font-semibold tracking-wide">科研项目信息化管理平台</div>
              <div className="truncate text-[10px] text-faint tracking-[0.22em] sm:tracking-[0.3em]">SCIENTIFIC RESEARCH PROJECT MANAGEMENT</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-faint num">
            <span className="chip">V19 二次完善版</span>
            <span className="chip">演示环境 DEMO</span>
            <span>{boot.today.replace(/-/g, '.')}</span>
          </div>
        </header>

        <div className="grow grid min-w-0 grid-cols-1 xl:grid-cols-[540px_minmax(0,1fr)] 2xl:grid-cols-[560px_minmax(0,1fr)] gap-8 xl:gap-12 items-center">
          <section className="fade-up w-full min-w-0 max-w-[calc(100vw-40px)] sm:max-w-[560px]">
            <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.32em] text-accent mb-3.5">
              <Sparkles size={14} />
              一本账 / 全生命周期 / 分级管控
            </div>
            <h1 className="break-words text-[30px] sm:text-[34px] xl:text-[35px] leading-[1.24] font-bold mb-3">
              科研项目全生命周期<br />信息化管控体系
            </h1>
            <p className="max-w-full text-[13px] leading-[1.72] text-dim mb-5 sm:max-w-[540px]">
              继承 V18 登录页的角色化入口和科研蓝图视觉，按 V19 反馈补充领导决策查看、项目台账字段口径、
              可视化看板逻辑、成果转化独立台账和表单维护。后评价按本轮反馈暂缓建设，避免干扰当前演示主线。
            </p>

            <div className="grid w-full min-w-0 grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-4 gap-2 max-w-full sm:max-w-[560px] mb-6">
              {V19_POINTS.map((x) => (
                <div key={x.text} className="card min-w-0 h-[34px] px-3 flex items-center gap-2 text-[10.5px] leading-tight text-dim">
                  <span className="text-accent shrink-0">{x.icon}</span>
                  <span className="min-w-0 truncate">{x.text}</span>
                </div>
              ))}
            </div>

            <div className="text-[11.5px] tracking-[0.18em] text-faint mb-3">选择角色账号进入演示</div>
            <div className="flex w-full min-w-0 flex-col gap-1.5 max-w-full sm:max-w-[540px] xl:max-w-[560px]">
              {users.map((u, i) => {
                const off = u.status !== '在岗'
                const meta = ROLE_META[u.role]
                return (
                  <button
                    key={u.id}
                    disabled={off}
                    onClick={() => {
                      if (!off) {
                        login(u)
                        nav(ROLE_HOME[u.role])
                      }
                    }}
                    className={`card group flex min-h-[58px] w-full min-w-0 items-center gap-3.5 px-4 py-2.5 text-left transition-all duration-200 fade-up ${
                      off ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:border-[rgba(56,189,248,0.45)] hover:bg-[rgba(56,189,248,0.05)]'
                    }`}
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-accent bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.25)]">
                      {meta.icon}
                    </span>
                    <span className="grow min-w-0 overflow-hidden">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold">{u.name}</span>
                        <span className="chip">{ROLE_LABEL[u.role]}</span>
                        <span className="chip">{meta.accent}</span>
                        {off && (
                          <span className="chip" style={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.4)' }}>
                            已离岗 / 权限已回收
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] leading-[18px] text-faint mt-0.5 truncate">{u.title} / {meta.desc}</span>
                    </span>
                    <ChevronRight size={16} className="text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )
              })}
            </div>
          </section>

          <section className="hidden xl:flex flex-col gap-3.5 fade-up min-w-0" style={{ animationDelay: '120ms' }}>
            <div className="flex gap-2.5 justify-end">
              {[
                ['项目层级', `${levels}`],
                ['立项渠道', `${enabledChannels}`],
                ['承担单位', `${managedUnits}`],
              ].map(([k, v]) => (
                <div key={k} className="card min-w-[120px] px-3.5 py-1.5 flex items-baseline justify-between gap-2.5">
                  <span className="text-[10.5px] text-faint">{k}</span>
                  <span className="num text-[17px] font-semibold text-accent">{v}</span>
                </div>
              ))}
            </div>
            <ArtAirfoilFlow className="w-full max-h-[300px]" />
            <div className="grid grid-cols-2 gap-3.5">
              <ArtFeaMesh className="w-full" />
              <ArtVortexStreet className="w-full" />
            </div>
          </section>
        </div>

        <footer className="mt-8 xl:mt-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[10.5px] text-faint">
          <span>
            依据《科研项目信息化管理平台需求 V18/V19》构建 / 交互演示版 /{' '}
            <a href="/traceability.html" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              需求对照矩阵
            </a>
          </span>
          <span className="num tracking-widest">RED / YELLOW / BLUE / GREEN 四色管控</span>
        </footer>
      </div>
    </div>
  )
}
