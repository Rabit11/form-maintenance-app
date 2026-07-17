import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import { api } from '../../api/client'
import { useSession } from '../../store/session'
import type { Four } from '../../lib/status'
import { Btn, Card, KPI, StatusDot, Tag, Empty, Modal, Field, Input, Select, Textarea, useToast } from '../../components/ui'
import { EChart } from '../../components/charts/EChart'
import { wan, fmtDate } from '../../lib/format'

interface FundRow { year: number; budget: number; spent: number; writeoffs: { date: string; amount: number; voucher: string; note: string }[] }
interface Row { id: number; code: string; name: string; status: string; color: Four; total: number; funds: FundRow[] }
interface Data {
  unit: { id: number; name: string; short: string }
  rows: Row[]
  trend: { year: number; budget: number; spent: number }[]
  quota: { quota: number; paid: number } | null
}

export default function Finance() {
  const { user } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const [d, setD] = useState<Data | null>(null)
  const thisYear = 2026
  const [woOpen, setWoOpen] = useState(false)
  const [woForm, setWoForm] = useState({ projectId: '', amount: '', note: '' })
  const [bgOpen, setBgOpen] = useState(false)
  const [bgForm, setBgForm] = useState({ projectId: '', budget: '', milestone: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { if (user) api.get<Data>(`/finance/${user.unit_id}`).then(setD) }, [user])
  useEffect(load, [load])

  const canEdit = user?.role === 'finance'

  const submitWriteoff = async () => {
    setBusy(true)
    try {
      const r = await api.post<{ voucher: string }>('/finance/writeoff', { projectId: Number(woForm.projectId), year: thisYear, amount: Number(woForm.amount), note: woForm.note })
      toast(`核销完成，凭证号 ${r.voucher}，已同步经费看板`)
      setWoOpen(false); setWoForm({ projectId: '', amount: '', note: '' }); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const submitBudget = async () => {
    setBusy(true)
    try {
      await api.post('/finance/budget', { projectId: Number(bgForm.projectId), year: thisYear, budget: Number(bgForm.budget), milestone: bgForm.milestone })
      toast('年度预算已填报备案')
      setBgOpen(false); setBgForm({ projectId: '', budget: '', milestone: '' }); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const syncFunds = async () => {
    try {
      const r = await api.post<{ updated: number }>('/sync/funds')
      toast(`已从单位经费平台抓取执行数据，更新 ${r.updated} 条`)
      load()
    } catch (e) { toast((e as Error).message, 'err') }
  }

  const totals = useMemo(() => {
    if (!d) return null
    const y = d.rows.flatMap((r) => r.funds.filter((f) => f.year === thisYear))
    return {
      budget: y.reduce((s, f) => s + f.budget, 0),
      spent: y.reduce((s, f) => s + f.spent, 0),
      writeoffs: d.rows.flatMap((r) => r.funds.flatMap((f) => f.writeoffs.map((w) => ({ ...w, pname: r.name })))).sort((a, b) => b.date.localeCompare(a.date)),
    }
  }, [d])

  const trendOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    return {
      grid: { left: 54, right: 20, top: 38, bottom: 26 },
      legend: { top: 4, left: 6 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: d.trend.map((x) => `${x.year}`) },
      yAxis: { type: 'value' },
      series: [
        { name: '预算', type: 'bar', barWidth: 18, itemStyle: { color: 'rgba(56,189,248,0.35)', borderRadius: [3, 3, 0, 0] }, data: d.trend.map((x) => x.budget) },
        { name: '支出', type: 'bar', barWidth: 18, itemStyle: { color: '#38BDF8', borderRadius: [3, 3, 0, 0] }, data: d.trend.map((x) => x.spent) },
      ],
    }
  }, [d])

  if (!d || !totals) return <div className="text-faint text-sm py-20 text-center">加载中…</div>
  const execRate = totals.budget ? Math.round((totals.spent / totals.budget) * 100) : 0

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-faint">
          {d.unit.name} · 经费执行管理（与总部预算管控双轨独立，数据实时同步经费看板）· 预算填报绑定里程碑，核销须上传付款凭证
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Btn size="sm" onClick={syncFunds}>同步经费系统</Btn>
            <Btn size="sm" onClick={() => setBgOpen(true)}>预算填报</Btn>
            <Btn size="sm" variant="primary" onClick={() => setWoOpen(true)}>录入核销</Btn>
          </div>
        )}
      </div>
      <div className="grid grid-cols-5 gap-3">
        <KPI label={`${thisYear} 年度预算`} value={Math.round(totals.budget)} unit="万元" />
        <KPI label="年度支出" value={Math.round(totals.spent)} unit="万元" tone="accent" />
        <KPI label="执行率" value={execRate} unit="%" tone={execRate >= 50 ? 'green' : 'yellow'} />
        <KPI label="总部年度额度" value={d.quota?.quota ?? 0} unit="万元" sub="总部核定拨付上限" />
        <KPI label="已拨付到账" value={d.quota?.paid ?? 0} unit="万元" sub={`剩余额度 ${wan((d.quota?.quota ?? 0) - (d.quota?.paid ?? 0))} 万`} />
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card title="近三年预算与支出（万元）" pad={false} className="col-span-2">
          <EChart option={trendOpt} height={250} />
        </Card>
        <Card title="项目经费台账" pad={false} className="col-span-3">
          <div className="max-h-[250px] overflow-y-auto">
            <table className="dtable">
              <thead><tr><th>项目</th><th>状态</th><th className="text-right">总经费</th><th className="text-right">年度预算</th><th className="text-right">年度支出</th><th className="text-right">执行率</th></tr></thead>
              <tbody>
                {d.rows.map((r) => {
                  const f = r.funds.find((x) => x.year === thisYear)
                  const rate = f && f.budget ? Math.round((f.spent / f.budget) * 100) : null
                  return (
                    <tr key={r.id} className="clickable" onClick={() => nav(`/projects/${r.id}`)}>
                      <td className="max-w-[260px]">
                        <span className="flex items-center gap-2"><StatusDot color={r.color} /><span className="truncate">{r.name}</span></span>
                      </td>
                      <td><Tag tone={r.status === '已验收' ? 'green' : 'accent'}>{r.status}</Tag></td>
                      <td className="num text-right">{wan(r.total)}</td>
                      <td className="num text-right text-dim">{f ? wan(f.budget) : '—'}</td>
                      <td className="num text-right text-dim">{f ? wan(f.spent) : '—'}</td>
                      <td className={`num text-right ${rate == null ? 'text-faint' : rate > 100 ? 'text-sred' : rate >= 50 ? 'text-sgreen' : 'text-syellow'}`}>{rate == null ? '—' : `${rate}%`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="核销记录（付款凭证留痕，可审计溯源）" pad={false}>
        <div className="max-h-[300px] overflow-y-auto">
          <table className="dtable">
            <thead><tr><th>核销日期</th><th>凭证号</th><th>所属项目</th><th>支出用途</th><th className="text-right">金额(万元)</th></tr></thead>
            <tbody>
              {totals.writeoffs.slice(0, 40).map((w, i) => (
                <tr key={i}>
                  <td className="num text-dim">{fmtDate(w.date)}</td>
                  <td className="num text-[11.5px] text-accent">{w.voucher}</td>
                  <td className="text-dim max-w-[280px] truncate">{w.pname}</td>
                  <td className="text-dim">{w.note}</td>
                  <td className="num text-right">{wan(w.amount, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totals.writeoffs.length === 0 && <Empty />}
        </div>
      </Card>

      <Modal open={woOpen} onClose={() => setWoOpen(false)} title="经费核销录入（付款凭证留痕）" width={480}>
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint">里程碑闭环后核销预算，凭证号自动登记，数据实时同步总部及本单位经费看板。</div>
          <Field label="所属项目" required>
            <Select value={woForm.projectId} onChange={(e) => setWoForm({ ...woForm, projectId: e.target.value })}>
              <option value="">选择项目…</option>
              {d.rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="核销金额（万元）" required><Input type="number" value={woForm.amount} onChange={(e) => setWoForm({ ...woForm, amount: e.target.value })} /></Field>
          <Field label="支出用途"><Textarea rows={2} placeholder="试验件采购 / 外协测试费 / 材料费…" value={woForm.note} onChange={(e) => setWoForm({ ...woForm, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setWoOpen(false)}>取消</Btn>
            <Btn variant="primary" disabled={busy || !woForm.projectId || !Number(woForm.amount)} onClick={submitWriteoff}>确认核销</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={bgOpen} onClose={() => setBgOpen(false)} title={`${thisYear} 年度预算填报（绑定里程碑）`} width={480}>
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint">审批链：项目团队提报 → 二级单位财务部门审核 → 总部财务团队复核备案（演示环境直接备案生效）。</div>
          <Field label="所属项目" required>
            <Select value={bgForm.projectId} onChange={(e) => setBgForm({ ...bgForm, projectId: e.target.value })}>
              <option value="">选择项目…</option>
              {d.rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="年度预算（万元）" required><Input type="number" value={bgForm.budget} onChange={(e) => setBgForm({ ...bgForm, budget: e.target.value })} /></Field>
          <Field label="绑定里程碑节点"><Input placeholder="如：完成地面集成试验" value={bgForm.milestone} onChange={(e) => setBgForm({ ...bgForm, milestone: e.target.value })} /></Field>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setBgOpen(false)}>取消</Btn>
            <Btn variant="primary" disabled={busy || !bgForm.projectId || bgForm.budget === ''} onClick={submitBudget}>提交备案</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
