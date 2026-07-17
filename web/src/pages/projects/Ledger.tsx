import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Search, Columns3 } from 'lucide-react'
import { api } from '../../api/client'
import type { Project } from '../../api/types'
import { useSession } from '../../store/session'
import { Btn, Card, FourBadge, Input, Select, StatusDot, Tag, Empty, Bar } from '../../components/ui'
import { wan, fmtDate, daysText } from '../../lib/format'
import { FOUR_HEX, FOUR_SHORT } from '../../lib/status'
import type { Four } from '../../lib/status'

const ALL_COLS = ['编号', '层级/渠道', '专业/单位', '项目周期', '状态', '预警', '里程碑', '经费拆分', '年度预算/支出', '负责人', '交付/协作', '成果转化', '下一节点'] as const
type Col = typeof ALL_COLS[number]

export default function Ledger() {
  const { boot, user, unitOf, channelOf } = useSession()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [rows, setRows] = useState<Project[] | null>(null)
  const [kw, setKw] = useState('')
  const [colOpen, setColOpen] = useState(false)
  const [cols, setCols] = useState<Set<Col>>(new Set(ALL_COLS))

  const level = sp.get('level') || ''
  const unit = sp.get('unit') || ''
  const status = sp.get('status') || ''
  const color = sp.get('color') || ''
  const channel = sp.get('channel') || ''

  useEffect(() => {
    const q = new URLSearchParams()
    if (level) q.set('level', level)
    if (unit) q.set('unit', unit)
    if (status) q.set('status', status)
    if (color) q.set('color', color)
    if (channel) q.set('channel', channel)
    if (kw) q.set('kw', kw)
    api.get<Project[]>(`/projects?${q}`).then(setRows)
  }, [level, unit, status, color, channel, kw])

  const setFilter = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    if (v) n.set(k, v); else n.delete(k)
    setSp(n, { replace: true })
  }

  const summary = useMemo(() => {
    if (!rows) return null
    return {
      n: rows.length,
      budget: rows.reduce((s, r) => s + r.total_budget, 0),
      colors: (['red', 'yellow', 'blue', 'green'] as Four[]).map((c) => [c, rows.filter((r) => r.color === c).length] as const),
    }
  }, [rows])

  const units = boot?.units.filter((u) => u.kind === 'unit') || []
  const channels = boot?.channels || []
  const isTeam = user?.role === 'team'

  return (
    <div className="flex flex-col gap-4 fade-up">
      {/* 筛选条 */}
      <Card pad className="!p-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input aria-label="搜索" placeholder="项目名称 / 编号" value={kw} onChange={(e) => setKw(e.target.value)} style={{ width: 220, paddingLeft: 32 }} />
          </div>
          <Select aria-label="层级" value={level} onChange={(e) => setFilter('level', e.target.value)} style={{ width: 108 }}>
            <option value="">全部层级</option>
            {['国家级', '地方级', '公司级'].map((l) => <option key={l}>{l}</option>)}
          </Select>
          <Select aria-label="渠道" value={channel} onChange={(e) => setFilter('channel', e.target.value)} style={{ width: 190 }}>
            <option value="">全部渠道</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {!isTeam && (
            <Select aria-label="单位" value={unit} onChange={(e) => setFilter('unit', e.target.value)} style={{ width: 130 }}>
              <option value="">全部单位</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.short}</option>)}
            </Select>
          )}
          <Select aria-label="状态" value={status} onChange={(e) => setFilter('status', e.target.value)} style={{ width: 110 }}>
            <option value="">全部状态</option>
            {['申报中', '立项中', '实施中', '验收中', '已验收', '已终止'].map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select aria-label="预警" value={color} onChange={(e) => setFilter('color', e.target.value)} style={{ width: 110 }}>
            <option value="">全部预警</option>
            {(['red', 'yellow', 'blue', 'green'] as Four[]).map((c) => <option key={c} value={c}>{FOUR_SHORT[c]}色</option>)}
          </Select>
          <div className="grow" />
          <div className="relative">
            <Btn onClick={() => setColOpen((v) => !v)}><Columns3 size={14} />列配置</Btn>
            {colOpen && (
              <div className="absolute right-0 top-10 z-30 card shadow-2xl p-3 w-[210px]" style={{ background: '#131D33' }}>
                {ALL_COLS.map((c) => (
                  <label key={c} className="flex items-center gap-2 py-1 text-[12.5px] cursor-pointer text-dim hover:text-ink">
                    <input type="checkbox" checked={cols.has(c)} onChange={(e) => {
                      const n = new Set(cols); if (e.target.checked) n.add(c); else n.delete(c); setCols(n)
                    }} className="accent-[#38BDF8]" />
                    {c}
                  </label>
                ))}
              </div>
            )}
          </div>
          {(user?.role === 'mgmt' || user?.role === 'admin') && (
            <a href="/api/projects.xlsx" download>
              <Btn variant="primary"><Download size={14} />导出 Excel</Btn>
            </a>
          )}
        </div>
      </Card>

      {/* 汇总条 */}
      {summary && (
        <div className="flex items-center gap-5 text-[12px] text-dim px-1">
          <span>共 <b className="num text-ink">{summary.n}</b> 项</span>
          <span>经费合计 <b className="num text-accent">{wan(summary.budget)}</b> 万元</span>
          <span className="flex items-center gap-3">
            {summary.colors.map(([c, n]) => (
              <button key={c} className="flex items-center gap-1.5 cursor-pointer hover:text-ink" onClick={() => setFilter('color', color === c ? '' : c)}>
                <StatusDot color={c} /><span className="num">{n}</span>
              </button>
            ))}
          </span>
          {user?.role === 'team' && <Tag tone="accent">仅显示本人关联项目</Tag>}
          {user?.role === 'finance' && <Tag tone="accent">本单位项目 · 经费视角</Tag>}
          {user?.role === 'leader' && <Tag tone="accent">领导只读：看板 / 台账 / 成果转化台账</Tag>}
        </div>
      )}

      {/* 台账表 */}
      <Card pad={false} className="overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <table className="dtable">
            <thead>
              <tr>
                <th>项目名称</th>
                {cols.has('编号') && <th>编号</th>}
                {cols.has('层级/渠道') && <th>层级 / 渠道</th>}
                {cols.has('专业/单位') && <th>专业 / 管理单位</th>}
                {cols.has('项目周期') && <th>项目周期</th>}
                {cols.has('状态') && <th>状态</th>}
                {cols.has('预警') && <th>预警</th>}
                {cols.has('里程碑') && <th style={{ minWidth: 120 }}>里程碑进度</th>}
                {cols.has('经费拆分') && <th className="text-right">经费拆分(万)</th>}
                {cols.has('年度预算/支出') && <th className="text-right">年度预算 / 支出</th>}
                {cols.has('负责人') && <th>负责人</th>}
                {cols.has('交付/协作') && <th>交付 / 协作</th>}
                {cols.has('成果转化') && <th>成果转化</th>}
                {cols.has('下一节点') && <th>下一到期节点</th>}
              </tr>
            </thead>
            <tbody>
              {rows?.map((p) => {
                const ch = channelOf(p.channel_id)
                return (
                  <tr key={p.id} className="clickable" onClick={() => nav(`/projects/${p.id}`)}>
                    <td className="max-w-[280px]">
                      <div className="flex items-center gap-2">
                        <StatusDot color={p.color} pulse={p.color === 'red'} />
                        <span className="truncate font-medium text-[13px]">{p.name}</span>
                      </div>
                    </td>
                    {cols.has('编号') && <td className="num text-dim">{p.code}</td>}
                    {cols.has('层级/渠道') && <td>
                      <span className="flex items-center gap-1.5">
                        <Tag tone={p.level === '国家级' ? 'accent' : p.level === '地方级' ? 'violet' : 'dim'}>{p.level}</Tag>
                        <span className="text-dim text-[11.5px] max-w-[130px] truncate inline-block align-middle">{ch?.name}</span>
                      </span>
                    </td>}
                    {cols.has('专业/单位') && <td className="text-[11.5px]">
                      <div className="text-dim">{p.v19.major1} / {p.v19.major2}</div>
                      <div className="text-faint">{p.v19.managerUnit} · {unitOf(p.lead_unit_id)?.short}</div>
                    </td>}
                    {cols.has('项目周期') && <td className="num text-dim text-[11.5px]">
                      {p.v19.launchMonth} – {p.v19.endMonth}
                      <div className="text-faint">{p.v19.projectMonths || '—'} 个月</div>
                    </td>}
                    {cols.has('状态') && <td><Tag tone={p.status === '已验收' ? 'green' : p.status === '验收中' ? 'yellow' : p.status === '已终止' ? 'dim' : 'accent'}>{p.status}</Tag></td>}
                    {cols.has('预警') && <td><FourBadge color={p.color} label={FOUR_SHORT[p.color]} /></td>}
                    {cols.has('里程碑') && <td>
                      <div className="flex items-center gap-2">
                        <div className="w-[64px]"><Bar value={p.progress} color={FOUR_HEX[p.color]} height={5} /></div>
                        <span className="num text-[11px] text-faint">{p.msDone}/{p.msTotal}</span>
                      </div>
                    </td>}
                    {cols.has('经费拆分') && <td className="num text-right">
                      {wan(p.total_budget)}
                      <div className="text-[10.5px] text-faint">国拨 {wan(p.v19.centralGrant)} / 自筹 {wan(p.v19.selfFund)}</div>
                    </td>}
                    {cols.has('年度预算/支出') && <td className="num text-right text-dim">{wan(p.yearBudget)} / {wan(p.yearSpent)}</td>}
                    {cols.has('负责人') && <td className="text-dim">{p.team.owner}</td>}
                    {cols.has('交付/协作') && <td className="text-[11.5px] text-dim">
                      <div>{p.v19.deliverableSummary}</div>
                      <div className="text-faint">{p.v19.collaboratorSummary}</div>
                    </td>}
                    {cols.has('成果转化') && <td className="text-[11.5px] max-w-[180px]">
                      <span className={p.v19.transformCount ? 'text-accent' : 'text-faint'}>{p.v19.transformSummary}</span>
                    </td>}
                    {cols.has('下一节点') && <td className="text-[11.5px] max-w-[200px]">
                      {p.nextMilestone ? (
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-dim">{p.nextMilestone.title}</span>
                          <span className={`num shrink-0 ${p.nextMilestone.daysLeft < 0 ? 'text-sred' : p.nextMilestone.daysLeft <= 30 ? 'text-syellow' : 'text-faint'}`}>
                            {daysText(p.nextMilestone.daysLeft)}
                          </span>
                        </span>
                      ) : <span className="text-faint">—</span>}
                    </td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows && rows.length === 0 && <Empty text="没有符合筛选条件的项目" />}
        </div>
      </Card>
    </div>
  )
}
