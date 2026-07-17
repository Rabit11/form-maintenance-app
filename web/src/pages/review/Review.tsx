import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { Approval, Project } from '../../api/types'
import { useSession } from '../../store/session'
import { Btn, Card, Drawer, Tag, Textarea, useToast, Empty, KPI, StatusDot } from '../../components/ui'
import { fmtDate, wan } from '../../lib/format'
import { APPROVAL_TYPE_LABEL } from '../approvals/Approvals'
import { IconChief } from '../../components/icons'

export default function Review() {
  const { user } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const [queue, setQueue] = useState<Approval[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [sel, setSel] = useState<Approval | null>(null)
  const [opinion, setOpinion] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get<Approval[]>('/approvals?mine=1').then(setQueue)
    api.get<Project[]>('/projects').then(setProjects)
  }, [])
  useEffect(load, [load])

  const act = async (action: 'approve' | 'reject') => {
    if (!sel) return
    setBusy(true)
    try {
      await api.post(`/approvals/${sel.id}/act`, { action, comment: opinion || (action === 'approve' ? '技术路线可行，同意。' : '技术方案需完善，退回。') })
      toast(action === 'approve' ? '技术复核通过，流程继续流转' : '已退回修改')
      setSel(null); setOpinion(''); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const risky = projects.filter((p) => p.color === 'red' || p.color === 'yellow')

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="grid grid-cols-4 gap-3">
        <KPI label="待技术把关" value={queue.length} unit="件" tone={queue.length ? 'accent' : 'default'} sub="建议书 / 任务书 / 验收申请" />
        <KPI label="经手项目" value={projects.length} unit="项" sub="按专业划分标准（总部统一定义）" />
        <KPI label="风险关注" value={risky.length} unit="项" tone={risky.some((p) => p.color === 'red') ? 'red' : risky.length ? 'yellow' : 'default'} sub="红黄状态项目" />
        <KPI label="经手项目经费" value={Math.round(projects.reduce((s, p) => s + p.total_budget, 0) / 10000 * 10) / 10} decimals={1} unit="亿元" tone="accent" />
      </div>

      <div className="grid grid-cols-5 gap-4 items-start">
        <Card title="评审队列（线上材料评审）" pad={false} className="col-span-3">
          {queue.length === 0 && <Empty text="暂无待评审事项" />}
          {queue.map((a) => (
            <button key={a.id} onClick={() => { setSel(a); setOpinion('') }}
              className="w-full text-left px-5 py-4 hairline-b flex items-start gap-3.5 cursor-pointer hover:bg-[rgba(56,189,248,0.04)] transition-colors">
              <span className="w-9 h-9 rounded-lg bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.25)] text-accent flex items-center justify-center shrink-0 mt-0.5">
                <IconChief size={17} />
              </span>
              <span className="grow min-w-0">
                <span className="flex items-center gap-2 mb-1">
                  <Tag tone="accent">{APPROVAL_TYPE_LABEL[a.type]}</Tag>
                  <span className="text-[13px] font-medium truncate">{a.title}</span>
                </span>
                <span className="block text-[11px] text-faint">
                  发起 {fmtDate(a.created_at)} · 当前节点：{a.steps[a.current_step]?.title} · 涉及材料 {Array.isArray(a.payload.materials) ? (a.payload.materials as string[]).join('、') : '全套申报/验收材料'}
                </span>
              </span>
              <Btn size="sm" variant="primary" className="shrink-0">开始评审</Btn>
            </button>
          ))}
        </Card>

        <Card title="经手项目风险跟踪" pad={false} className="col-span-2">
          {risky.length === 0 && <Empty text="经手项目运行平稳" />}
          {risky.map((p) => (
            <button key={p.id} onClick={() => nav(`/projects/${p.id}`)}
              className="w-full text-left px-4 py-3 hairline-b flex items-center gap-3 cursor-pointer hover:bg-[rgba(56,189,248,0.04)]">
              <StatusDot color={p.color} pulse={p.color === 'red'} />
              <span className="grow min-w-0">
                <span className="block text-[12.5px] truncate">{p.name}</span>
                <span className="block text-[10.5px] text-faint mt-0.5">
                  {p.nextMilestone ? `${p.nextMilestone.title} · ${p.nextMilestone.daysLeft < 0 ? `超期${-p.nextMilestone.daysLeft}天` : `剩${p.nextMilestone.daysLeft}天`}` : p.status}
                </span>
              </span>
              <span className="num text-[11px] text-faint shrink-0">{wan(p.total_budget)}万</span>
            </button>
          ))}
        </Card>
      </div>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={`技术把关 · ${sel?.title}`} width={640}>
        {sel && (
          <div className="flex flex-col gap-5">
            <div className="card !bg-night2 p-4">
              <div className="text-[12px] text-dim mb-2.5">评审要点（{APPROVAL_TYPE_LABEL[sel.type]}）</div>
              <ul className="text-[12.5px] leading-6 text-ink list-disc pl-4">
                {sel.type === 'acceptance' ? (
                  <><li>全部里程碑是否闭环、佐证材料是否齐备</li><li>交付物与立项考核指标是否一一对应</li><li>外协交付物验收结论与经费核销匹配性</li></>
                ) : (
                  <><li>技术路线可行性与创新性、与专业发展方向一致性</li><li>研究目标与考核指标设置合理性</li><li>经费概算与研究内容匹配性、参研单位分工合理性</li></>
                )}
              </ul>
            </div>
            {sel.projectName && (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium">{sel.projectName}</div>
                  <div className="num text-[11px] text-faint mt-0.5">{sel.projectCode}</div>
                </div>
                <Btn size="sm" onClick={() => nav(`/projects/${sel.project_id}`)}>调阅项目全档</Btn>
              </div>
            )}
            {Array.isArray(sel.payload.materials) && (
              <div className="flex gap-2 flex-wrap">{(sel.payload.materials as string[]).map((m) => <Tag key={m} tone="accent">{m}.pdf</Tag>)}</div>
            )}
            <div className="border-t border-line pt-4 flex flex-col gap-3">
              <Textarea rows={3} placeholder="评审意见（将随流程留痕归档）…" value={opinion} onChange={(e) => setOpinion(e.target.value)} />
              <div className="flex gap-2.5 justify-end">
                <Btn variant="danger" disabled={busy} onClick={() => act('reject')}>退回修改</Btn>
                <Btn variant="primary" disabled={busy} onClick={() => act('approve')}>复核通过</Btn>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
