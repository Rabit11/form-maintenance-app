import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import { api } from '../../api/client'
import type { Dashboard } from '../../api/types'
import { useSession } from '../../store/session'
import { Card, KPI, Select, StatusDot, Empty, Tag } from '../../components/ui'
import { EChart } from '../../components/charts/EChart'
import { RadarSweep } from '../../components/art'
import { FOUR_HEX, FOUR_SHORT } from '../../lib/status'
import { wan, daysText } from '../../lib/format'

export default function Cockpit() {
  const { boot } = useSession()
  const nav = useNavigate()
  const [d, setD] = useState<Dashboard | null>(null)
  const [unit, setUnit] = useState('')
  const [level, setLevel] = useState('')
  const [year, setYear] = useState('')
  const [channel, setChannel] = useState('')

  useEffect(() => {
    const q = new URLSearchParams()
    if (unit) q.set('unit', unit)
    if (level) q.set('level', level)
    if (year) q.set('year', year)
    if (channel) q.set('channel', channel)
    api.get<Dashboard>(`/dashboard?${q}`).then(setD)
  }, [unit, level, year, channel])

  const fundsOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    return {
      grid: { left: 54, right: 44, top: 42, bottom: 28 },
      legend: { top: 6, left: 8, data: ['年度预算', '年度支出', '执行率'] },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: d.fundsTrend.map((x) => `${x.year}`) },
      yAxis: [
        { type: 'value' },
        { type: 'value', max: 120, axisLabel: { formatter: '{value}%' }, splitLine: { show: false } },
      ],
      series: [
        { name: '年度预算', type: 'bar', barWidth: 16, itemStyle: { color: 'rgba(56,189,248,0.35)', borderRadius: [3, 3, 0, 0] }, data: d.fundsTrend.map((x) => x.budget) },
        { name: '年度支出', type: 'bar', barWidth: 16, itemStyle: { color: '#38BDF8', borderRadius: [3, 3, 0, 0] }, data: d.fundsTrend.map((x) => x.spent) },
        {
          name: '执行率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6,
          lineStyle: { width: 2, color: '#34D399' }, itemStyle: { color: '#34D399' },
          data: d.fundsTrend.map((x) => (x.budget ? Math.round((x.spent / x.budget) * 100) : 0)),
        },
      ],
    }
  }, [d])

  const unitMatrixOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    const units = d.byUnit.filter((u) => u.count > 0)
    const mk = (key: 'red' | 'yellow' | 'blue' | 'green', name: string) => ({
      name, type: 'bar' as const, stack: 's', barWidth: 14,
      itemStyle: { color: FOUR_HEX[key], borderRadius: 0 },
      data: units.map((u) => u[key]),
    })
    return {
      grid: { left: 92, right: 30, top: 34, bottom: 24 },
      legend: { top: 4, left: 8 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', inverse: true, data: units.map((u) => u.unit) },
      series: [mk('red', '红·逾期'), mk('yellow', '黄·临期'), mk('blue', '蓝·推进'), mk('green', '绿·完成')],
    }
  }, [d])

  const unitLevelOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    const rows = d.unitLevelMatrix
    return {
      grid: { left: 92, right: 30, top: 34, bottom: 24 },
      legend: { top: 4, left: 8 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', inverse: true, data: rows.map((x) => x.unit) },
      series: [
        { name: '国家级', type: 'bar', stack: 'level', barWidth: 14, itemStyle: { color: '#38BDF8' }, data: rows.map((x) => x.国家级) },
        { name: '地方级', type: 'bar', stack: 'level', barWidth: 14, itemStyle: { color: '#A78BFA' }, data: rows.map((x) => x.地方级) },
        { name: '公司级', type: 'bar', stack: 'level', barWidth: 14, itemStyle: { color: '#34D399' }, data: rows.map((x) => x.公司级) },
      ],
    }
  }, [d])

  const fundStructOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, left: 'center' },
      series: [{
        type: 'pie', radius: ['48%', '72%'], center: ['50%', '44%'],
        label: { formatter: '{b}\n{d}%', fontSize: 10 },
        color: ['#38BDF8', '#34D399', '#FBBF24'],
        data: [
          { name: '国拨', value: d.fundStructure.centralGrant },
          { name: '自筹', value: d.fundStructure.selfFund },
          { name: '商飞内部', value: d.fundStructure.internalFund },
        ],
      }],
    }
  }, [d])

  const modelOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    const top = d.modelTransform.slice(0, 6)
    return {
      grid: { left: 108, right: 30, top: 14, bottom: 24 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', inverse: true, data: top.map((x) => x.model.length > 10 ? `${x.model.slice(0, 10)}…` : x.model), axisLabel: { fontSize: 10.5 } },
      series: [
        { name: '已完成', type: 'bar', stack: 'm', barWidth: 12, itemStyle: { color: '#34D399' }, data: top.map((x) => x.done) },
        { name: '转化中', type: 'bar', stack: 'm', barWidth: 12, itemStyle: { color: '#38BDF8' }, data: top.map((x) => x.running) },
      ],
    }
  }, [d])

  const levelOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    return {
      tooltip: { trigger: 'item', formatter: '{b}：{c} 项（{d}%）' },
      legend: { bottom: 0, left: 'center' },
      series: [{
        type: 'pie', radius: ['58%', '78%'], center: ['50%', '44%'],
        label: { show: false }, avoidLabelOverlap: true,
        itemStyle: { borderColor: '#111A2E', borderWidth: 2 },
        emphasis: { scaleSize: 4 },
        color: ['#38BDF8', '#A78BFA', '#34D399'],
        data: d.byLevel.map((x) => ({ name: x.level, value: x.count })),
      }],
      graphic: [{
        type: 'text', left: 'center', top: '38%',
        style: { text: `${d.kpis.total}`, fill: '#E2E8F0', fontSize: 26, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' },
      }, {
        type: 'text', left: 'center', top: '52%',
        style: { text: '在库项目', fill: '#5B6B84', fontSize: 11 },
      }],
    }
  }, [d])

  const delivOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    return {
      grid: { left: 40, right: 16, top: 34, bottom: 40 },
      legend: { top: 4, left: 8 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: d.delivByType.map((x) => x.type), axisLabel: { interval: 0, fontSize: 10.5 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        { name: '已交付', type: 'bar', stack: 'd', barWidth: 18, itemStyle: { color: '#34D399', borderRadius: 0 }, data: d.delivByType.map((x) => x.delivered) },
        { name: '待交付', type: 'bar', stack: 'd', barWidth: 18, itemStyle: { color: 'rgba(148,163,184,0.3)', borderRadius: [3, 3, 0, 0] }, data: d.delivByType.map((x) => x.pending) },
      ],
    }
  }, [d])

  const transformOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    return {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'funnel', left: 24, right: 24, top: 26, bottom: 10,
        minSize: '32%', sort: 'none', gap: 3,
        label: { show: true, position: 'inside', fontSize: 11, color: '#0B1120', fontWeight: 600, formatter: '{b} {c}' },
        itemStyle: { borderWidth: 0 },
        color: ['rgba(148,163,184,0.55)', '#38BDF8', '#FBBF24', '#34D399'],
        data: d.transform.map((x) => ({ name: x.stage, value: x.count })),
      }],
    }
  }, [d])

  const channelOpt = useMemo<EChartsOption>(() => {
    if (!d) return {}
    const top = d.byChannel.slice(0, 8)
    return {
      grid: { left: 120, right: 34, top: 10, bottom: 24 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', inverse: true, data: top.map((x) => x.channel.length > 9 ? x.channel.slice(0, 9) + '…' : x.channel), axisLabel: { fontSize: 10.5 } },
      series: [{
        type: 'bar', barWidth: 12,
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: 'rgba(56,189,248,0.25)' }, { offset: 1, color: '#38BDF8' }] }, borderRadius: [0, 3, 3, 0] },
        label: { show: true, position: 'right', color: '#94A3B8', fontSize: 10.5, fontFamily: 'JetBrains Mono' },
        data: top.map((x) => x.count),
      }],
    }
  }, [d])

  if (!d) return <div className="text-faint text-sm py-20 text-center">正在加载驾驶舱…</div>
  const units = boot?.units.filter((u) => u.kind === 'unit') || []

  return (
    <div className="flex flex-col gap-4 fade-up">
      {/* 筛选条 */}
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-faint">
          数据范围：全公司科研项目 · 实时归集 <span className="num">{d.today.replace(/-/g, '.')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select aria-label="年度" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 110, height: 32 }}>
            <option value="">全部年度</option>
            {[2026, 2025, 2024, 2023, 2022].map((y) => <option key={y} value={y}>{y} 年度</option>)}
          </Select>
          <Select aria-label="层级" value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 110, height: 32 }}>
            <option value="">全部层级</option>
            {['国家级', '地方级', '公司级'].map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
          <Select aria-label="渠道" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ width: 170, height: 32 }}>
            <option value="">全部渠道</option>
            {(boot?.channels || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select aria-label="单位" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 130, height: 32 }}>
            <option value="">全部单位</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.short}</option>)}
          </Select>
        </div>
      </div>

      {/* KPI 带 */}
      <div className="grid grid-cols-8 gap-3">
        <KPI label="在库项目" value={d.kpis.total} unit="项" sub={`在研 ${d.kpis.active} 项`} />
        <KPI label="经费总规模" value={d.kpis.totalBudget} decimals={1} unit="亿元" sub="立项批复口径" tone="accent" />
        <KPI label="国拨经费" value={d.fundStructure.centralGrant} unit="万元" sub={`自筹 ${wan(d.fundStructure.selfFund)} 万`} />
        <KPI label="年度预算" value={d.kpis.yearBudget} unit="万元" sub={`支出 ${wan(d.kpis.yearSpent)} 万元`} />
        <KPI label="总执行率" value={d.kpis.totalExecRate} unit="%" tone={d.kpis.totalExecRate >= 50 ? 'green' : 'yellow'} sub={`年度 ${d.kpis.execRate}%`} />
        <KPI label="逾期告警" value={d.kpis.red} unit="项" tone="red" sub="含里程碑/交付物" />
        <KPI label="成果包" value={d.transformSummary.total} unit="项" tone="green" sub={`已完成 ${d.transformSummary.done} 项`} />
        <KPI label="计划办结率" value={d.planStats.finishRate} unit="%" sub={`待办 ${d.planStats.todo} 项`} />
      </div>

      {/* 主-辅两栏 */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 flex flex-col gap-4">
          <Card title="年度经费预算与执行" extra={<span className="text-[11px] text-faint">双轨制 · 单位口径汇总（万元）</span>} pad={false}>
            <EChart option={fundsOpt} height={272} />
          </Card>
          <Card title="承担单位 × 项目层级承担矩阵" extra={
            <span className="text-[11px] text-faint">国家级 / 地方级 / 公司级承担情况</span>
          } pad={false}>
            <EChart option={unitLevelOpt} height={230} onClick={(p) => { const u = units.find((x) => x.short === p.name); if (u) nav(`/projects?unit=${u.id}`) }} />
          </Card>
          <Card title="计划管理状态" extra={
            <span className="flex items-center gap-3 text-[11px] text-faint">
              {d.planStats.cmosSync ? `CMOS 同步 ${d.planStats.cmosSync}` : 'CMOS 接口待联调'}
            </span>
          } pad={false}>
            <div className="grid grid-cols-4 gap-3 px-4 py-5">
              {(['red', 'yellow', 'blue', 'green'] as const).map((c) => (
                <button key={c} onClick={() => nav(`/plans`)} className="rounded-lg border border-line2 px-3 py-3 text-left hover:border-[rgba(56,189,248,0.4)] cursor-pointer">
                  <span className="flex items-center gap-1.5 text-[11.5px] text-faint"><StatusDot color={c} />{FOUR_SHORT[c]}计划</span>
                  <span className="num block text-[24px] mt-1" style={{ color: FOUR_HEX[c] }}>{d.planStats.colors[c]}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          <Card title="风险预警榜" extra={<div className="opacity-70 -mr-1 -mt-1"><RadarSweep size={40} /></div>} pad={false} className="grow">
            <div className="max-h-[420px] overflow-y-auto">
              {d.risks.length === 0 && <Empty text="当前无风险项目" />}
              {d.risks.map((r, i) => (
                <button key={i} onClick={() => nav(`/projects/${r.projectId}`)}
                  className="w-full text-left px-4 py-2.5 hairline-b flex items-start gap-2.5 cursor-pointer hover:bg-[rgba(56,189,248,0.04)] transition-colors">
                  <span className="mt-1.5"><StatusDot color={r.color} pulse={r.color === 'red'} /></span>
                  <span className="min-w-0 grow">
                    <span className="block text-[12.5px] leading-5 truncate">{r.project}</span>
                    <span className="block text-[11px] text-faint truncate">{r.kind} · {r.title}</span>
                  </span>
                  <span className={`num text-[11px] shrink-0 mt-0.5 ${r.color === 'red' ? 'text-sred' : 'text-syellow'}`}>{daysText(r.days)}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="项目层级分布" pad={false}>
            <EChart option={levelOpt} height={218} onClick={(p) => p.name && nav(`/projects?level=${encodeURIComponent(p.name)}`)} />
          </Card>
        </div>
      </div>

      {/* 底部带 */}
      <div className="grid grid-cols-12 gap-4">
        <Card title="交付物产出结构" pad={false} className="col-span-5">
          <EChart option={delivOpt} height={218} />
        </Card>
        <Card title="成果转化推进" extra={<span className="text-[11px] text-faint">成果包 {d.transform.reduce((s, x) => s + x.count, 0)} 项</span>} pad={false} className="col-span-3">
          <EChart option={transformOpt} height={218} />
        </Card>
        <Card title="经费构成" extra={<Tag tone="accent">在研 {wan(d.fundStructure.activeTotal)} 万</Tag>} pad={false} className="col-span-4">
          <EChart option={fundStructOpt} height={218} />
        </Card>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Card title="层级关联下的渠道项目分布 TOP8" pad={false} className="col-span-5">
          <EChart option={channelOpt} height={218} />
        </Card>
        <Card title="型号转化分布" extra={<span className="text-[11px] text-faint">点击成果台账查看明细</span>} pad={false} className="col-span-4">
          <EChart option={modelOpt} height={218} onClick={() => nav('/transformations')} />
        </Card>
        <Card title="里程碑四色矩阵口径" className="col-span-3">
          <div className="flex flex-col gap-2.5">
            {(['red', 'yellow', 'blue', 'green'] as const).map((c) => (
              <button key={c} onClick={() => nav(`/projects?color=${c}`)} className="flex items-center justify-between rounded-lg border border-line2 px-3 py-2 text-left hover:border-[rgba(56,189,248,0.35)] cursor-pointer">
                <span className="flex items-center gap-2 text-[12px]"><StatusDot color={c} />{FOUR_SHORT[c]}里程碑</span>
                <span className="num" style={{ color: FOUR_HEX[c] }}>{d.msColors[c]}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
