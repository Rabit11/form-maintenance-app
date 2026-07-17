import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Project, Approval } from '../../api/types'
import { useSession } from '../../store/session'
import { Btn, Card, Field, Select, Tag, Textarea, useToast, Empty } from '../../components/ui'
import { fmtDate } from '../../lib/format'
import { StepLine } from '../projects/Detail'

export default function Assessments() {
  const { user, channelOf } = useSession()
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [records, setRecords] = useState<Approval[]>([])
  const [form, setForm] = useState({ projectId: '', atype: '', note: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get<Project[]>('/projects').then((r) => setProjects(r.filter((p) => ['实施中', '验收中'].includes(p.status))))
    api.get<Approval[]>('/approvals').then((r) => setRecords(r.filter((a) => a.type === 'assessment')))
  }, [])
  useEffect(load, [load])

  const selProject = projects.find((p) => String(p.id) === form.projectId)
  const assessTypes = useMemo(() => (selProject ? channelOf(selProject.channel_id)?.assess || [] : []), [selProject, channelOf])

  const submit = async () => {
    if (!form.projectId) { toast('请选择项目', 'err'); return }
    if (!assessTypes.length) { toast('该渠道无评估检查要求（如科技周）', 'err'); return }
    setBusy(true)
    try {
      await api.post(`/projects/${form.projectId}/assessments`, { atype: form.atype || assessTypes[0], note: form.note })
      toast('评估检查申请已提交，材料同步归档')
      setForm({ projectId: '', atype: '', note: '' }); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className="grid grid-cols-5 gap-4 fade-up items-start">
      <Card title="发起评估检查申请" className="col-span-2">
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint leading-5">
            各渠道按需提报中期评估、季度报告、阶段性检查、督导材料等；评估结束后评审结论与佐证材料统一线上归档。
            评估不合格需启动整改流程，整改完成后方可继续推进项目。
          </div>
          <Field label="涉及项目" required>
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, atype: '' })}>
              <option value="">选择实施中项目…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          {selProject && (
            <Field label={`评估类型（${channelOf(selProject.channel_id)?.name} 渠道要求）`} required>
              {assessTypes.length ? (
                <Select value={form.atype || assessTypes[0]} onChange={(e) => setForm({ ...form, atype: e.target.value })}>
                  {assessTypes.map((t) => <option key={t}>{t}</option>)}
                </Select>
              ) : (
                <div className="text-[12px] text-syellow py-1.5">该渠道（如科技周）无评估检查要求</div>
              )}
            </Field>
          )}
          <Field label="评估说明"><Textarea rows={3} placeholder="评估安排、材料说明…（材料以模拟上传归档）" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <Btn variant="primary" disabled={busy || !assessTypes.length} onClick={submit}>{busy ? '提交中…' : '提交评估申请'}</Btn>
        </div>
      </Card>

      <Card title="评估检查台账" pad={false} className="col-span-3">
        {records.length === 0 && <Empty text="暂无评估检查记录" />}
        {records.map((a) => (
          <div key={a.id} className="px-5 py-3.5 hairline-b">
            <div className="flex items-center gap-2.5 mb-1.5">
              <Tag tone="accent">{String(a.payload.atype || '评估检查')}</Tag>
              <span className="text-[13px] font-medium truncate grow">{a.title}</span>
              <span className="num text-[11px] text-faint">{fmtDate(a.created_at)}</span>
              <Tag tone={a.status === '已通过' ? 'green' : a.status === '已驳回' ? 'red' : 'yellow'}>{a.status === '已通过' ? '评估办结' : a.status}</Tag>
            </div>
            <StepLine steps={a.steps} />
          </div>
        ))}
      </Card>
    </div>
  )
}
