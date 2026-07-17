import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShieldCheck } from 'lucide-react'
import { api } from '../../api/client'
import type { TransformationData } from '../../api/types'
import { useSession } from '../../store/session'
import { Btn, Card, Empty, FourBadge, Input, KPI, Select, Tag } from '../../components/ui'
import { fmtDate } from '../../lib/format'

export default function Transformations() {
  const nav = useNavigate()
  const { boot, user } = useSession()
  const [data, setData] = useState<TransformationData | null>(null)
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('')
  const [unit, setUnit] = useState('')
  const [kw, setKw] = useState('')

  useEffect(() => {
    const q = new URLSearchParams()
    if (status) q.set('status', status)
    if (mode) q.set('mode', mode)
    if (unit) q.set('unit', unit)
    if (kw) q.set('kw', kw)
    api.get<TransformationData>(`/transformations?${q}`).then(setData)
  }, [status, mode, unit, kw])

  const rows = data?.rows || []
  const units = boot?.units.filter((u) => u.kind === 'unit') || []
  const modelTargets = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows.filter((x) => x.mode === '向型号转化')) m.set(r.target, (m.get(r.target) || 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [rows])

  if (!data) return <div className="text-faint text-sm py-20 text-center">正在加载成果转化台账…</div>

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">成果转化独立台账</div>
          <div className="text-[11.5px] text-faint mt-0.5">成果包为最小管理单元，与交付物、项目台账和可视化看板双向绑定</div>
        </div>
        {user?.role === 'leader' && (
          <Tag tone="accent"><span className="inline-flex items-center gap-1"><ShieldCheck size={12} />领导只读视图</span></Tag>
        )}
      </div>

      <div className="grid grid-cols-5 gap-3">
        <KPI label="成果包总数" value={data.stats.total} unit="项" tone="accent" />
        <KPI label="向型号转化" value={data.stats.model} unit="项" sub="装机/未装机联动字典" />
        <KPI label="向市场转化" value={data.stats.market} unit="项" sub="转让/许可/联合实施等" />
        <KPI label="已完成转化" value={data.stats.done} unit="项" tone="green" />
        <KPI label="逾期成果" value={data.stats.overdue} unit="项" tone={data.stats.overdue ? 'red' : 'green'} />
      </div>

      <Card pad className="!p-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input aria-label="搜索成果" placeholder="成果包 / 项目 / 编号" value={kw} onChange={(e) => setKw(e.target.value)} style={{ width: 230, paddingLeft: 32 }} />
          </div>
          <Select aria-label="转化状态" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 130 }}>
            <option value="">全部状态</option>
            {['未启动', '洽谈中', '已签协议', '已完成'].map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="转化方式" value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: 140 }}>
            <option value="">全部方式</option>
            <option>向型号转化</option>
            <option>向市场转化</option>
          </Select>
          {user?.role !== 'leader' && (
            <Select aria-label="责任单位" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 130 }}>
              <option value="">全部单位</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.short}</option>)}
            </Select>
          )}
          <div className="grow" />
          <Btn onClick={() => { setStatus(''); setMode(''); setUnit(''); setKw('') }}>重置</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <Card title="型号转化分布" className="col-span-4" pad={false}>
          <div className="px-4 py-3 flex flex-col gap-2">
            {modelTargets.length === 0 && <Empty text="暂无向型号转化成果" />}
            {modelTargets.map(([target, count]) => (
              <div key={target} className="flex items-center gap-3">
                <div className="grow min-w-0">
                  <div className="text-[12.5px] truncate">{target}</div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-[rgba(148,163,184,0.12)] mt-1">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, count * 22)}%` }} />
                  </div>
                </div>
                <span className="num text-accent text-[13px]">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="成果包明细" className="col-span-8" pad={false}>
          <div className="overflow-x-auto max-h-[calc(100vh-350px)]">
            <table className="dtable">
              <thead><tr><th>成果包</th><th>关联项目</th><th>转化方式</th><th>状态</th><th>型号/交易对象</th><th>计划时间</th><th>交付物</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => nav(`/projects/${r.project_id}`)}>
                    <td>
                      <div className="font-medium max-w-[230px] truncate">{r.name}</div>
                      <div className="num text-[11px] text-accent">{r.code}</div>
                    </td>
                    <td>
                      <div className="max-w-[220px] truncate">{r.pname}</div>
                      <div className="num text-[10.5px] text-faint">{r.pcode} · {r.unitShort}</div>
                    </td>
                    <td><Tag tone={r.mode === '向型号转化' ? 'accent' : 'green'}>{r.mode} · {r.form}</Tag></td>
                    <td><FourBadge color={r.color} label={r.status} /></td>
                    <td className="max-w-[180px] truncate text-dim">{r.target}</td>
                    <td className="num text-dim">{fmtDate(r.plan_date)}</td>
                    <td className="text-[11.5px] text-faint">{r.deliverableCount} 项</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <Empty text="没有符合筛选条件的成果包" />}
          </div>
        </Card>
      </div>
    </div>
  )
}
