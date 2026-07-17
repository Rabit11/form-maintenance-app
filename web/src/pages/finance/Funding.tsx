import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { api } from '../../api/client'
import { useSession } from '../../store/session'
import { Btn, Card, KPI, Tag, useToast, Empty, Modal, Field, Input, Textarea } from '../../components/ui'
import { EChart } from '../../components/charts/EChart'
import { wan, fmtDate } from '../../lib/format'

interface Data {
  year: number
  pool: { year: number; total: number; note: string }[]
  quotas: { id: number; unit_id: number; short: string; quota: number; paid: number }[]
  requests: { id: number; unit_id: number; short: string; amount: number; purpose: string; status: string; created_at: string; decided_at: string | null }[]
}

export default function Funding() {
  const { user } = useSession()
  const toast = useToast()
  const [d, setD] = useState<Data | null>(null)
  const [reqOpen, setReqOpen] = useState(false)
  const [form, setForm] = useState({ amount: '', purpose: '' })
  const isHq = user?.role === 'mgmt'
  const isFin = user?.role === 'finance'

  const load = useCallback(() => { api.get<Data>('/funding').then(setD) }, [])
  useEffect(load, [load])

  const totals = useMemo(() => {
    if (!d) return null
    const pool = d.pool.find((p) => p.year === d.year)
    const allocated = d.quotas.reduce((s, q) => s + q.quota, 0)
    const paid = d.quotas.reduce((s, q) => s + q.paid, 0)
    return { total: pool?.total ?? 0, allocated, paid, note: pool?.note }
  }, [d])

  const quotaOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    return {
      grid: { left: 96, right: 56, top: 30, bottom: 24 },
      legend: { top: 2, left: 6 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${wan(v as number)} 万元` },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', inverse: true, data: d.quotas.map((q) => q.short) },
      series: [
        { name: '已拨付', type: 'bar', stack: 'q', barWidth: 15, itemStyle: { color: '#38BDF8' }, data: d.quotas.map((q) => q.paid) },
        {
          name: '剩余额度', type: 'bar', stack: 'q', barWidth: 15, itemStyle: { color: 'rgba(148,163,184,0.25)', borderRadius: [0, 3, 3, 0] },
          label: { show: true, position: 'right', fontSize: 10.5, color: '#5B6B84', fontFamily: 'JetBrains Mono', formatter: (p: { dataIndex: number }) => `${Math.round((d.quotas[p.dataIndex].paid / d.quotas[p.dataIndex].quota) * 100)}%` },
          data: d.quotas.map((q) => q.quota - q.paid),
        },
      ],
    }
  }, [d])

  const act = async (id: number, action: 'approve' | 'reject') => {
    try {
      await api.post(`/funding/requests/${id}/act`, { action })
      toast(action === 'approve' ? '双审通过，拨付已执行，台账已更新' : '申请已驳回')
      load()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  const submitReq = async () => {
    if (!form.amount) { toast('请填写申请金额', 'err'); return }
    try {
      await api.post('/funding/requests', { amount: Number(form.amount), purpose: form.purpose })
      toast('拨付申请已提交总部双审')
      setReqOpen(false); setForm({ amount: '', purpose: '' }); load()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  if (!d || !totals) return <div className="text-faint text-sm py-20 text-center">加载中…</div>

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-faint">
          总部经费预算管控 · 与二级单位项目端经费<b className="text-dim">完全独立</b> · 年度总盘经总部管理层审批锁定，作为拨付唯一依据
        </div>
        {isFin && <Btn variant="primary" onClick={() => setReqOpen(true)}>发起拨付申请</Btn>}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KPI label={`${d.year} 年度总盘子`} value={totals.total} unit="万元" tone="accent" sub={totals.note} />
        <KPI label="核定额度合计" value={totals.allocated} unit="万元" sub={`${d.quotas.length} 家单位`} />
        <KPI label="累计已拨付" value={totals.paid} unit="万元" tone="green" sub={`拨付进度 ${Math.round((totals.paid / totals.allocated) * 100)}%`} />
        <KPI label="待审批申请" value={d.requests.filter((r) => r.status === '待审批').length} unit="件" tone={d.requests.some((r) => r.status === '待审批') ? 'yellow' : 'default'} sub="总部科技部 + 财务部双审" />
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card title="各单位年度额度与拨付执行" pad={false} className="col-span-3">
          <EChart option={quotaOpt} height={260} />
        </Card>
        <Card title="拨付申请队列" pad={false} className="col-span-2">
          <div className="max-h-[260px] overflow-y-auto">
            {d.requests.map((r) => (
              <div key={r.id} className="px-4 py-3 hairline-b">
                <div className="flex items-center gap-2 mb-1">
                  <Tag tone="dim">{r.short}</Tag>
                  <span className="num text-[14px] font-semibold text-accent">{wan(r.amount)} 万</span>
                  <span className="ml-auto">
                    <Tag tone={r.status === '已拨付' ? 'green' : r.status === '已驳回' ? 'red' : 'yellow'}>{r.status}</Tag>
                  </span>
                </div>
                <div className="text-[11.5px] text-dim leading-4 line-clamp-1">{r.purpose}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="num text-[10.5px] text-faint">申请 {fmtDate(r.created_at)}{r.decided_at ? ` · 办结 ${fmtDate(r.decided_at)}` : ''}</span>
                  {isHq && r.status === '待审批' && (
                    <span className="ml-auto flex gap-1.5">
                      <Btn size="sm" variant="danger" onClick={() => act(r.id, 'reject')}>驳回</Btn>
                      <Btn size="sm" variant="success" onClick={() => act(r.id, 'approve')}>双审通过·拨付</Btn>
                    </span>
                  )}
                </div>
              </div>
            ))}
            {d.requests.length === 0 && <Empty />}
          </div>
        </Card>
      </div>

      <Card title="年度清算">
        <div className="text-[12.5px] text-dim leading-6">
          {d.pool.filter((p) => p.year !== d.year).map((p) => (
            <div key={p.year} className="flex items-center gap-3">
              <Tag tone="green">已清算</Tag>
              <span className="num">{p.year}</span> 年度总盘子 <b className="num text-ink">{wan(p.total)}</b> 万元 · {p.note} · 清算结果作为下一年度经费预算编制参考依据
            </div>
          ))}
        </div>
      </Card>

      <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="发起经费拨付申请" width={480}>
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint">在核定的年度额度内提交申请 → 总部科技部与财务部双审 → 拨付执行并自动更新台账</div>
          <Field label="申请金额（万元）" required><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="拨付用途"><Textarea rows={2} placeholder="对应里程碑节点 / 用途说明…" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setReqOpen(false)}>取消</Btn>
            <Btn variant="primary" onClick={submitReq}>提交申请</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
