import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { Project, Approval, AlertRow } from '../../api/types'
import { useSession } from '../../store/session'
import { Card, FourBadge, StatusDot, Tag, Bar, Empty, Btn } from '../../components/ui'
import { wan, fmtDate, daysText } from '../../lib/format'
import { FOUR_HEX } from '../../lib/status'
import { IconDeclare, IconMilestone, IconPlan, IconChange } from '../../components/icons'
import { RadarSweep } from '../../components/art'
import { APPROVAL_TYPE_LABEL } from '../approvals/Approvals'

export default function Workbench() {
  const { user, boot, channelOf } = useSession()
  const nav = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])

  useEffect(() => {
    api.get<Project[]>('/projects').then(setProjects)
    api.get<Approval[]>('/approvals').then(setApprovals)
    api.get<AlertRow[]>('/alerts').then(setAlerts)
  }, [])

  const mine = approvals.filter((a) => a.initiator === user?.name)
  const doing = mine.filter((a) => a.status === '审批中')
  const myAlerts = alerts.slice(0, 6)

  return (
    <div className="flex flex-col gap-4 fade-up">
      {/* 欢迎条 */}
      <Card pad className="!p-5 relative overflow-hidden">
        <div className="absolute -right-8 -top-10 opacity-40 pointer-events-none"><RadarSweep size={190} /></div>
        <div className="relative">
          <div className="text-[11px] tracking-[0.25em] text-accent mb-2">PROJECT TEAM WORKSPACE</div>
          <h1 className="text-[20px] font-bold mb-1">{user?.name}，您好</h1>
          <p className="text-[12.5px] text-dim">{user?.title} · 今日 <span className="num">{boot?.today.replace(/-/g, '.')}</span> · 名下项目 <b className="num text-accent">{projects.length}</b> 项，在途流程 <b className="num text-accent">{doing.length}</b> 件</p>
          <div className="flex gap-2.5 mt-4">
            <Btn variant="primary" onClick={() => nav('/declare')}><IconDeclare size={14} />发起项目申报</Btn>
            <Btn onClick={() => nav('/milestones')}><IconMilestone size={14} />里程碑填报</Btn>
            <Btn onClick={() => nav('/plans')}><IconPlan size={14} />计划办结</Btn>
            <Btn onClick={() => nav('/changes')}><IconChange size={14} />申请变更</Btn>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {/* 我的项目 */}
        <div className="col-span-2 flex flex-col gap-3">
          <div className="text-[12px] tracking-wider text-faint px-1">我的项目（仅本人关联，提交前可编辑）</div>
          {projects.map((p) => (
            <button key={p.id} onClick={() => nav(`/projects/${p.id}`)}
              className="card text-left px-5 py-4 cursor-pointer hover:border-[rgba(56,189,248,0.4)] transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <StatusDot color={p.color} pulse={p.color === 'red'} />
                <span className="text-[14px] font-semibold grow truncate">{p.name}</span>
                <Tag tone={p.status === '验收中' ? 'yellow' : p.status === '申报中' ? 'violet' : 'accent'}>{p.status}</Tag>
                <FourBadge color={p.color} />
              </div>
              <div className="flex items-center gap-5 text-[11.5px] text-faint">
                <span className="num">{p.code}</span>
                <span>{channelOf(p.channel_id)?.name}</span>
                <span>总经费 <b className="num text-dim">{wan(p.total_budget)}</b> 万</span>
                <span className="num">{fmtDate(p.start)} – {fmtDate(p.end)}</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="grow"><Bar value={p.progress} color={FOUR_HEX[p.color]} height={5} /></div>
                <span className="num text-[11px] text-faint shrink-0">里程碑 {p.msDone}/{p.msTotal}</span>
                {p.nextMilestone && (
                  <span className={`text-[11px] shrink-0 ${p.nextMilestone.daysLeft < 0 ? 'text-sred' : p.nextMilestone.daysLeft <= 30 ? 'text-syellow' : 'text-faint'}`}>
                    下一节点：{p.nextMilestone.title}（{daysText(p.nextMilestone.daysLeft)}）
                  </span>
                )}
              </div>
            </button>
          ))}
          {projects.length === 0 && <Card><Empty text="暂无关联项目，可发起项目申报" /></Card>}
        </div>

        {/* 右栏 */}
        <div className="flex flex-col gap-4">
          <Card title="我的流程" pad={false}>
            {mine.length === 0 && <Empty text="暂无发起的流程" />}
            <div className="max-h-[260px] overflow-y-auto">
              {mine.slice(0, 8).map((a) => (
                <div key={a.id} className="px-4 py-2.5 hairline-b">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag tone={a.status === '已通过' ? 'green' : a.status === '已驳回' ? 'red' : 'accent'}>{APPROVAL_TYPE_LABEL[a.type]}</Tag>
                    <span className="text-[11px] text-faint num ml-auto">{fmtDate(a.created_at)}</span>
                  </div>
                  <div className="text-[12px] leading-5 truncate">{a.title}</div>
                  {a.status === '审批中' && a.steps[a.current_step] && (
                    <div className="text-[11px] text-accent mt-0.5">等待：{a.steps[a.current_step].title}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
          <Card title="我的预警" pad={false}>
            {myAlerts.length === 0 && <Empty text="暂无预警" />}
            {myAlerts.map((a) => (
              <button key={a.id} onClick={() => a.project_id && nav(`/projects/${a.project_id}`)}
                className="w-full text-left px-4 py-2.5 hairline-b flex gap-2.5 items-start cursor-pointer hover:bg-[rgba(56,189,248,0.04)]">
                <span className="mt-1"><StatusDot color={a.level} pulse={a.level === 'red'} /></span>
                <span className="text-[11.5px] leading-5">{a.title}</span>
              </button>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
