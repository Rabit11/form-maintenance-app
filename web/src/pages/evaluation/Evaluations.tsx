import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { api } from '../../api/client'
import type { Collaborator } from '../../api/types'
import { useSession } from '../../store/session'
import { Btn, Card, Tag, Tabs, Empty, Bar, KPI, Modal, Input, useToast } from '../../components/ui'
import { fmtDate, daysText } from '../../lib/format'

const SCORE_LABEL: Record<string, string> = { tech: '技术能力', quality: '交付质量', schedule: '进度履约', service: '服务配合', compliance: '合规性' }

const DIMS: { key: 'tech' | 'quality' | 'schedule' | 'service' | 'compliance'; label: string }[] = [
  { key: 'tech', label: '技术能力' }, { key: 'quality', label: '交付质量' }, { key: 'schedule', label: '进度履约' },
  { key: 'service', label: '服务配合' }, { key: 'compliance', label: '合规性' },
]

export default function Evaluations({ tab: initTab }: { tab: 'collab' | 'post' }) {
  const nav = useNavigate()
  const { user } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState<string>(initTab === 'post' ? 'collab' : initTab)
  const [data, setData] = useState<{ collaborators: Collaborator[]; postEvals: unknown[] } | null>(null)
  const [scoring, setScoring] = useState<Collaborator | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { setTab(initTab === 'post' ? 'collab' : initTab) }, [initTab])
  const load = useCallback(() => { api.get<{ collaborators: Collaborator[]; postEvals: unknown[] }>('/evaluations').then(setData) }, [])
  useEffect(load, [load])

  const canScore = user?.role === 'mgmt' || user?.role === 'team'
  const total = Math.round(DIMS.reduce((s, d2) => s + (Number(scores[d2.key]) || 0), 0) / 5)

  const submitScore = async () => {
    if (!scoring) return
    setBusy(true)
    try {
      const r = await api.post<{ total: number; grade: string }>(`/collaborators/${scoring.id}/evaluate`, {
        scores: Object.fromEntries(DIMS.map((d2) => [d2.key, Number(scores[d2.key]) || 0])),
      })
      toast(`评价完成：${r.total} 分（${r.grade}）${r.grade === '不合格' ? '，已按程序纳入黑名单' : ''}`)
      setScoring(null); setScores({}); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const stats = useMemo(() => {
    const cs = data?.collaborators.filter((c) => c.total != null) || []
    return {
      evaluated: cs.length,
      pending: (data?.collaborators.length || 0) - cs.length,
      excellent: cs.filter((c) => c.grade === '优秀').length,
      blacklist: cs.filter((c) => c.blacklisted === 1).length,
      avg: cs.length ? Math.round(cs.reduce((s, c) => s + (c.total || 0), 0) / cs.length) : 0,
    }
  }, [data])

  if (!data) return <div className="text-faint text-sm py-20 text-center">加载中…</div>

  return (
    <div className="flex flex-col gap-4 fade-up">
      <Tabs value={tab} onChange={(k) => { setTab(k); nav('/evaluations', { replace: true }) }} items={[
        { key: 'collab', label: '协作单位评价' },
        { key: 'black', label: '黑名单' },
      ]} />

      {tab === 'collab' && (
        <>
          <div className="grid grid-cols-5 gap-3">
            <KPI label="已完成评价" value={stats.evaluated} unit="家次" />
            <KPI label="待评价" value={stats.pending} unit="家次" tone={stats.pending ? 'yellow' : 'default'} sub="验收/合同完成后30日内" />
            <KPI label="优秀（≥90分）" value={stats.excellent} unit="家次" tone="green" />
            <KPI label="平均得分" value={stats.avg} unit="分" tone="accent" />
            <KPI label="黑名单" value={stats.blacklist} unit="家" tone={stats.blacklist ? 'red' : 'default'} sub="不合格（<60分）纳入" />
          </div>
          <Card pad={false}>
            <table className="dtable">
              <thead><tr><th>协作单位</th><th>类型</th><th>所属项目</th><th>五维评分</th><th className="text-right">总分</th><th>等级</th><th>评价日期</th><th>评价人</th></tr></thead>
              <tbody>
                {data.collaborators.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => nav(`/projects/${c.project_id}`)}>
                    <td className="font-medium max-w-[220px] truncate">
                      <span className="flex items-center gap-2">
                        {c.blacklisted === 1 && <ShieldAlert size={13} className="text-sred shrink-0" />}
                        {c.name}
                      </span>
                    </td>
                    <td><Tag tone={c.ctype === '参研' ? 'accent' : 'dim'}>{c.ctype}</Tag></td>
                    <td className="text-dim max-w-[220px] truncate">{c.pname}</td>
                    <td style={{ minWidth: 190 }}>
                      {c.scores ? (
                        <div className="flex items-center gap-1" title={Object.entries(c.scores).map(([k, v]) => `${SCORE_LABEL[k]} ${v}`).join(' / ')}>
                          {Object.values(c.scores).map((v, i) => (
                            <div key={i} className="w-8"><Bar value={v} height={4} color={v >= 90 ? '#34D399' : v >= 60 ? '#38BDF8' : '#F87171'} /></div>
                          ))}
                        </div>
                      ) : <span className="text-faint text-[11.5px]">待评分</span>}
                    </td>
                    <td className={`num text-right font-semibold ${c.total == null ? 'text-faint' : c.total >= 90 ? 'text-sgreen' : c.total >= 60 ? 'text-ink' : 'text-sred'}`}>{c.total ?? '—'}</td>
                    <td>
                      {c.grade
                        ? <Tag tone={c.grade === '优秀' ? 'green' : c.grade === '不合格' ? 'red' : c.grade === '良好' ? 'accent' : 'dim'}>{c.grade}</Tag>
                        : c.deadline
                          ? <Tag tone={(c.daysLeft ?? 99) < 0 ? 'red' : 'yellow'}>待评价 · {daysText(c.daysLeft ?? 0)}</Tag>
                          : <Tag tone="yellow">待评价</Tag>}
                    </td>
                    <td className="num text-dim">{fmtDate(c.eval_date)}</td>
                    <td className="text-dim">
                      {c.evaluator || (c.total == null && canScore
                        ? <Btn size="sm" variant="success" onClick={(e) => { e.stopPropagation(); setScoring(c); setScores({}) }}>五维评分</Btn>
                        : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === 'black' && (
        <Card title="协作单位黑名单" extra={<span className="text-[11px] text-faint">不合格（&lt;60分）· 需佐证材料并按程序协调法律部门纳入</span>}>
          {data.collaborators.filter((c) => c.blacklisted === 1).length === 0 && <Empty text="黑名单为空" />}
          {data.collaborators.filter((c) => c.blacklisted === 1).map((c) => (
            <div key={c.id} className="card !bg-[rgba(248,113,113,0.05)] !border-[rgba(248,113,113,0.3)] p-4 mb-3">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert size={16} className="text-sred" />
                <span className="text-[14px] font-semibold">{c.name}</span>
                <Tag tone="red">评分 {c.total} · 不合格</Tag>
                <span className="text-[11px] text-faint num ml-auto">纳入日期 {fmtDate(c.eval_date)}</span>
              </div>
              <div className="text-[12px] text-dim">涉及项目：{c.pname}（{c.pcode}）</div>
              {c.note && <div className="text-[12px] text-sred mt-1.5 leading-5">{c.note}</div>}
              <div className="flex gap-4 mt-3">
                {c.scores && Object.entries(c.scores).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <div className={`num text-[15px] font-semibold ${v < 60 ? 'text-sred' : 'text-dim'}`}>{v}</div>
                    <div className="text-[10px] text-faint">{SCORE_LABEL[k]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={!!scoring} onClose={() => setScoring(null)} title={`协作单位五维评分 · ${scoring?.name}`} width={460}>
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint">
            所属项目：{scoring?.pname} · {scoring?.ctype}单位
            {scoring?.deadline && <>（评价时限 {fmtDate(scoring.deadline)}，{daysText(scoring.daysLeft ?? 0)}）</>}
            <br />评价流程：项目团队评分 → 单位管理团队确认 → 结果自动定级；不合格（&lt;60分）按程序纳入黑名单。
          </div>
          {DIMS.map((d2) => (
            <div key={d2.key} className="flex items-center gap-3">
              <span className="text-[12.5px] text-dim w-16 shrink-0">{d2.label}</span>
              <input type="range" min={0} max={100} value={Number(scores[d2.key]) || 0}
                onChange={(e) => setScores({ ...scores, [d2.key]: e.target.value })}
                className="grow accent-[#38BDF8]" aria-label={d2.label} />
              <Input type="number" min={0} max={100} value={scores[d2.key] || ''} placeholder="0"
                onChange={(e) => setScores({ ...scores, [d2.key]: e.target.value })} style={{ width: 68, height: 30 }} />
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[12px] text-dim">总分（五维平均）</span>
            <span className={`num text-[24px] font-bold ${total >= 90 ? 'text-sgreen' : total >= 60 ? 'text-accent' : 'text-sred'}`}>{total}</span>
          </div>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setScoring(null)}>取消</Btn>
            <Btn variant="primary" disabled={busy || DIMS.some((d2) => scores[d2.key] === undefined || scores[d2.key] === '')} onClick={submitScore}>提交评价</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
