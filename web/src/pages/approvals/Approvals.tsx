import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paperclip, UserRoundCog, Undo2, RotateCcw } from 'lucide-react'
import { api, apiUpload } from '../../api/client'
import type { Approval } from '../../api/types'
import { useSession } from '../../store/session'
import { Btn, Card, Drawer, Tag, Tabs, Textarea, Empty, useToast, DL, Input } from '../../components/ui'
import { fmtDate } from '../../lib/format'

export const APPROVAL_TYPE_LABEL: Record<string, string> = {
  declaration: '申报审签', filing: '立项备案', change: '项目变更', data_change: '数据变更',
  milestone_close: '里程碑销项', plan_finish: '计划办结', acceptance: '项目验收',
  funding: '经费拨付', package: '成果转化备案', evaluation: '协作评价确认',
  baseinfo: '基本信息建档', assessment: '评估检查',
}

export default function Approvals() {
  const { user } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('todo')
  const [rows, setRows] = useState<Approval[] | null>(null)
  const [sel, setSel] = useState<Approval | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [delegateTo, setDelegateTo] = useState('')
  const [delegateOpen, setDelegateOpen] = useState(false)
  const attachRef = useRef<HTMLInputElement>(null)

  const lifecycle = async (action: 'withdraw' | 'resubmit' | 'delegate', body?: Record<string, unknown>) => {
    if (!sel) return
    setBusy(true)
    try {
      await api.post(`/approvals/${sel.id}/${action}`, body || {})
      toast(action === 'withdraw' ? '流程已撤销，项目回归草稿状态（记录永久留存）' : action === 'resubmit' ? '已重新提交，流程自初始节点重新流转' : '已转办至指定经办人')
      setSel(null); setDelegateOpen(false); setDelegateTo(''); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const attachFile = async (f: File | null) => {
    if (!f || !sel) return
    setBusy(true)
    try {
      const up = await apiUpload(f)
      await api.post(`/approvals/${sel.id}/attach`, { uploadId: up.id })
      toast(`附件「${up.name}」已更新并归档`)
      const fresh = await api.get<Approval[]>(`/approvals`)
      setSel(fresh.find((x) => x.id === sel.id) || null)
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally {
      setBusy(false)
      if (attachRef.current) attachRef.current.value = ''
    }
  }

  const load = useCallback(() => {
    const q = tab === 'todo' ? '?mine=1' : tab === 'doing' ? '?status=审批中' : ''
    api.get<Approval[]>(`/approvals${q}`).then((r) => setRows(tab === 'done' ? r.filter((a) => a.status !== '审批中') : r))
  }, [tab])
  useEffect(load, [load])

  const act = async (action: 'approve' | 'reject') => {
    if (!sel) return
    setBusy(true)
    try {
      await api.post(`/approvals/${sel.id}/act`, { action, comment })
      toast(action === 'approve' ? '已签署同意，流程推进至下一节点' : '已驳回，退回填报节点')
      setSel(null); setComment(''); load()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally { setBusy(false) }
  }

  const counts = useMemo(() => rows?.length ?? 0, [rows])

  return (
    <div className="flex flex-col gap-4 fade-up">
      <Tabs value={tab} onChange={setTab} items={[
        { key: 'todo', label: '待我审批' },
        { key: 'doing', label: '在途流程' },
        { key: 'done', label: '已办结' },
      ]} />
      <div className="text-[12px] text-faint px-1">
        {tab === 'todo' ? `当前节点等待「${user?.name}」签署的流程 ${counts} 件` : `共 ${counts} 件`}
        · 审批驳回将自动退回初始填报节点并留痕归档
      </div>
      <Card pad={false}>
        {rows?.length === 0 && <Empty text={tab === 'todo' ? '暂无待办审批' : '暂无流程'} />}
        {rows?.map((a) => (
          <button key={a.id} onClick={() => { setSel(a); setComment('') }}
            className="w-full text-left px-5 py-3.5 hairline-b flex items-center gap-4 cursor-pointer hover:bg-[rgba(56,189,248,0.04)] transition-colors">
            <Tag tone={a.status === '已通过' ? 'green' : a.status === '已驳回' ? 'red' : 'accent'}>{APPROVAL_TYPE_LABEL[a.type] || a.type}</Tag>
            <div className="grow min-w-0">
              <div className="text-[13px] font-medium truncate">{a.title}</div>
              <div className="text-[11px] text-faint mt-0.5">
                发起人 {a.initiator} · {fmtDate(a.created_at)}
                {a.status === '审批中' && a.steps[a.current_step] && <> · 当前节点：<span className="text-accent">{a.steps[a.current_step].title}</span></>}
              </div>
            </div>
            <span className="num text-[11px] text-faint shrink-0">{a.steps.filter((s) => s.status === 'approved').length}/{a.steps.length} 节点</span>
            <Tag tone={a.status === '已通过' ? 'green' : a.status === '已驳回' ? 'red' : 'yellow'}>{a.status}</Tag>
          </button>
        ))}
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.title} width={620}>
        {sel && (
          <div className="flex flex-col gap-5">
            <DL cols={3} items={[
              ['流程类型', APPROVAL_TYPE_LABEL[sel.type]],
              ['发起人', sel.initiator],
              ['发起日期', fmtDate(sel.created_at)],
            ]} />
            {sel.projectName && (
              <div className="card !bg-night2 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[12.5px] font-medium">{sel.projectName}</div>
                  <div className="num text-[11px] text-faint mt-0.5">{sel.projectCode}</div>
                </div>
                <Btn size="sm" onClick={() => nav(`/projects/${sel.project_id}`)}>查看项目详情</Btn>
              </div>
            )}
            {(Array.isArray(sel.payload.materials) || Array.isArray(sel.payload.attachments)) && (
              <div>
                <div className="text-[12px] text-dim mb-2 flex items-center justify-between">
                  <span>随附材料</span>
                  {sel.status === '审批中' && (
                    <>
                      <input ref={attachRef} type="file" className="hidden" onChange={(e) => attachFile(e.target.files?.[0] || null)} />
                      <Btn size="sm" disabled={busy} onClick={() => attachRef.current?.click()}><Paperclip size={12} />替换 / 补充附件</Btn>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {((sel.payload.materials as string[]) || []).map((m) => <Tag key={m} tone="accent">{m}.pdf</Tag>)}
                  {((sel.payload.attachments as { name: string; by: string; at: string }[]) || []).map((a2, i) => (
                    <Tag key={`att${i}`} tone="green">{a2.name}（{a2.by} · {fmtDate(a2.at)} 更新）</Tag>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="text-[12px] text-dim mb-3">审签流转（{sel.steps.filter((s) => s.status === 'approved').length}/{sel.steps.length}）</div>
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-line2" />
                {sel.steps.map((s, i) => (
                  <div key={i} className="relative pb-4 last:pb-0">
                    <span className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center text-[8px] ${
                      s.status === 'approved' ? 'bg-[rgba(52,211,153,0.2)] border-sgreen text-sgreen'
                      : s.status === 'current' ? 'bg-[rgba(56,189,248,0.2)] border-accent'
                      : s.status === 'rejected' ? 'bg-[rgba(248,113,113,0.2)] border-sred text-sred' : 'border-line2 bg-night2'
                    }`}>{s.status === 'approved' ? '✓' : s.status === 'rejected' ? '✕' : ''}</span>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[12.5px] ${s.status === 'current' ? 'text-accent font-medium' : s.status === 'pending' ? 'text-faint' : 'text-ink'}`}>{s.title}</span>
                      {s.assignee && <span className="text-[11px] text-faint">{s.actor || s.assignee}</span>}
                      {s.at && <span className="num text-[10.5px] text-faint">{fmtDate(s.at)}</span>}
                      {s.status === 'current' && <Tag tone="accent">当前节点</Tag>}
                    </div>
                    {s.comment && <div className="text-[11.5px] text-dim mt-1">「{s.comment}」</div>}
                  </div>
                ))}
              </div>
            </div>
            {sel.status === '审批中' && (
              <div className="border-t border-line pt-4 flex flex-col gap-3">
                <Textarea rows={2} placeholder="审批意见（选填）…" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex gap-2.5 items-center">
                  {sel.initiator === user?.name && (
                    <Btn size="sm" disabled={busy} onClick={() => lifecycle('withdraw')} title="仅填报人可发起撤销，撤销后回归草稿状态">
                      <Undo2 size={13} />撤销流程
                    </Btn>
                  )}
                  {(user?.role === 'mgmt' || user?.role === 'admin') && (
                    delegateOpen ? (
                      <span className="flex items-center gap-1.5">
                        <Input placeholder="转办给（姓名）" value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} style={{ width: 130, height: 30 }} />
                        <Btn size="sm" variant="primary" disabled={busy || !delegateTo.trim()} onClick={() => lifecycle('delegate', { to: delegateTo })}>确认</Btn>
                        <Btn size="sm" onClick={() => setDelegateOpen(false)}>取消</Btn>
                      </span>
                    ) : (
                      <Btn size="sm" disabled={busy} onClick={() => setDelegateOpen(true)}><UserRoundCog size={13} />转办</Btn>
                    )
                  )}
                  <span className="grow" />
                  <Btn variant="danger" disabled={busy} onClick={() => act('reject')}>驳回退改</Btn>
                  <Btn variant="primary" disabled={busy} onClick={() => act('approve')}>签署同意</Btn>
                </div>
              </div>
            )}
            {['已驳回', '已撤销'].includes(sel.status) && sel.initiator === user?.name && (
              <div className="border-t border-line pt-4 flex justify-end">
                <Btn variant="primary" disabled={busy} onClick={() => lifecycle('resubmit')}>
                  <RotateCcw size={13} />修改完善后重新提交
                </Btn>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
