import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { Project, ProjectFull, Milestone } from '../../api/types'
import { Btn, Card, FourBadge, Modal, StatusDot, Textarea, useToast, Empty, Tag } from '../../components/ui'
import { fmtDate, daysText } from '../../lib/format'

export default function Milestones() {
  const toast = useToast()
  const [details, setDetails] = useState<ProjectFull[]>([])
  const [target, setTarget] = useState<{ m: Milestone; pname: string } | null>(null)
  const [evidence, setEvidence] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const projects = await api.get<Project[]>('/projects')
    const active = projects.filter((p) => ['实施中', '验收中'].includes(p.status))
    setDetails(await Promise.all(active.map((p) => api.get<ProjectFull>(`/projects/${p.id}`))))
  }, [])
  useEffect(() => { load() }, [load])

  const complete = async () => {
    if (!target) return
    setBusy(true)
    try {
      await api.post(`/milestones/${target.m.id}/complete`, { evidence: evidence || '完成佐证材料.pdf' })
      toast('已闭环销项，状态转为绿色（已完成）')
      setTarget(null); setEvidence(''); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="text-[12px] text-faint">
        年度两次管理：年初（四月前）填报本年度总体目标与分项里程碑清单 · 节点到期后上传佐证材料闭环销项 · 需延期必须经【项目变更】审批，禁止直接修改
      </div>
      {details.map((p) => (
        <Card key={p.id} title={<span className="flex items-center gap-2.5">{p.name}<span className="num text-[11px] text-faint font-normal">{p.code}</span></span>}
          extra={<span className="flex items-center gap-3"><Tag>{p.year_goal ? `年度目标：${p.year_goal}` : p.status}</Tag><FourBadge color={p.color} /></span>} pad={false}>
          <table className="dtable">
            <thead><tr><th style={{ width: 40 }}>#</th><th>里程碑</th><th>计划完成</th><th>状态</th><th>完成/剩余</th><th>佐证材料</th><th style={{ width: 120 }}></th></tr></thead>
            <tbody>
              {p.milestones.map((m) => (
                <tr key={m.id}>
                  <td className="num text-faint">{m.seq}</td>
                  <td className="font-medium max-w-[340px] truncate">{m.title}</td>
                  <td className="num text-dim">{fmtDate(m.due)}</td>
                  <td><FourBadge color={m.color} /></td>
                  <td className="num text-[11.5px]">
                    {m.done_at ? <span className="text-sgreen">{fmtDate(m.done_at)}</span>
                      : <span className={m.color === 'red' ? 'text-sred' : m.color === 'yellow' ? 'text-syellow' : 'text-faint'}>{daysText(m.daysLeft)}</span>}
                  </td>
                  <td className="text-[11.5px] text-faint max-w-[200px] truncate">{m.evidence || (m.delay_reason ? <span className="text-sred">滞后：{m.delay_reason}</span> : '—')}</td>
                  <td className="text-right">
                    {!m.done_at && (
                      m.color === 'red'
                        ? <span className="flex items-center gap-1.5 justify-end text-[11px] text-sred"><StatusDot color="red" pulse />需走延期变更</span>
                        : <Btn size="sm" variant="success" onClick={() => setTarget({ m, pname: p.name })}>上传佐证·销项</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
      {details.length === 0 && <Card><Empty text="暂无实施中项目" /></Card>}

      <Modal open={!!target} onClose={() => setTarget(null)} title={`里程碑闭环销项 · ${target?.m.title}`}>
        <div className="flex flex-col gap-4">
          <div className="text-[12px] text-dim">项目：{target?.pname} · 计划完成 <span className="num">{fmtDate(target?.m.due)}</span></div>
          <Textarea rows={3} placeholder="佐证材料说明（试验报告、评审纪要等，演示环境模拟上传）…" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          <div className="text-[11.5px] text-faint">销项后经单位科技部门核验，材料审核办结自动转为绿色完成状态，同步更新台账与看板。</div>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setTarget(null)}>取消</Btn>
            <Btn variant="primary" disabled={busy} onClick={complete}>{busy ? '提交中…' : '确认销项'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
