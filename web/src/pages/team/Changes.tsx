import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { Project, Approval } from '../../api/types'
import { useSession } from '../../store/session'
import { Btn, Card, Field, Select, Tag, Textarea, useToast, Empty } from '../../components/ui'
import { fmtDate } from '../../lib/format'
import { StepLine } from '../projects/Detail'

const CATS = { 项目变更: ['延期', '经费', '外协方', '付款节点', '核心指标'], 数据变更: ['数据修正'] }

export default function Changes() {
  const { user } = useSession()
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [mine, setMine] = useState<Approval[]>([])
  const [form, setForm] = useState({ projectId: '', kind: '项目变更', category: '延期', detail: '', reason: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get<Project[]>('/projects').then(setProjects)
    api.get<Approval[]>('/approvals').then((r) => setMine(r.filter((a) => ['change', 'data_change'].includes(a.type) && a.initiator === user?.name)))
  }, [user])
  useEffect(load, [load])

  const submit = async () => {
    if (!form.projectId || !form.detail.trim()) { toast('请选择项目并填写调整内容', 'err'); return }
    setBusy(true)
    try {
      await api.post('/changes', { ...form, projectId: Number(form.projectId) })
      toast(`${form.kind}申请已提交`)
      setForm({ ...form, detail: '', reason: '' }); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className="grid grid-cols-5 gap-4 fade-up items-start">
      <Card title="发起变更申请" className="col-span-2">
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint leading-5">
            实施阶段唯一调整渠道：里程碑延期、经费、外协方、核心指标等修改均须在线发起，禁止直接后台改动。
            重大变更（外协更换 / 总经费调整 / 整体周期变更）强制联动法务部门审核。
          </div>
          <Field label="变更类别" required>
            <div className="flex gap-2">
              {(['项目变更', '数据变更'] as const).map((k) => (
                <button key={k} onClick={() => setForm({ ...form, kind: k, category: CATS[k][0] })}
                  className={`grow px-3 py-2.5 rounded-lg border text-[12.5px] cursor-pointer transition-all ${
                    form.kind === k ? 'border-accent bg-[rgba(56,189,248,0.08)] text-accent font-medium' : 'border-line2 text-dim hover:text-ink'}`}>
                  {k}
                  <span className="block text-[10px] mt-0.5 font-normal opacity-70">{k === '项目变更' ? '重大调整 · 二级+总部逐级审批' : '小幅纠错 · 二级审批+总部确认'}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="涉及项目" required>
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">选择项目…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="调整事项" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATS[form.kind as keyof typeof CATS].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="调整内容" required><Textarea rows={2} placeholder="如：「完成地面集成试验」节点由 2026-10 调整至 2027-01" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></Field>
          <Field label="变更缘由"><Textarea rows={2} placeholder="说明原因并上传佐证支撑材料…" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <Btn variant="primary" disabled={busy} onClick={submit}>{busy ? '提交中…' : '提交变更申请'}</Btn>
        </div>
      </Card>

      <Card title="我的变更记录" pad={false} className="col-span-3">
        {mine.length === 0 && <Empty text="暂无变更申请" />}
        {mine.map((a) => (
          <div key={a.id} className="px-5 py-3.5 hairline-b">
            <div className="flex items-center gap-2.5 mb-1.5">
              <Tag tone={a.type === 'change' ? 'accent' : 'dim'}>{a.type === 'change' ? '项目变更' : '数据变更'}</Tag>
              <span className="text-[13px] font-medium truncate grow">{a.title}</span>
              <span className="num text-[11px] text-faint">{fmtDate(a.created_at)}</span>
              <Tag tone={a.status === '已通过' ? 'green' : a.status === '已驳回' ? 'red' : 'yellow'}>{a.status}</Tag>
            </div>
            <StepLine steps={a.steps} />
          </div>
        ))}
      </Card>
    </div>
  )
}
