import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Paperclip, Download, Lock, CheckCircle2, XCircle, FileUp, Plus } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import { api } from '../../api/client'
import type { ProjectFull, ApprovalStep } from '../../api/types'
import { useSession } from '../../store/session'
import { Card, DL, FourBadge, StatusDot, Tabs, Tag, Empty, Bar, Btn, Modal, Field, Input, Textarea, Select, useToast } from '../../components/ui'
import { EChart } from '../../components/charts/EChart'
import { LifecycleDiagram } from '../../components/art'
import { wan, fmtDate, daysText } from '../../lib/format'
import { FOUR_HEX, FOUR_LABEL } from '../../lib/status'

const DELIV_TYPES = ['专利', '论文', '软著', '技术标准', '原理样机', '设备', '成套技术成果']
/** 验收表单分级栏目：非本层级栏目锁定不可编辑（需求 §四(三)） */
const TIERS: { key: string; label: string; levels: string[] }[] = [
  { key: 'unit', label: '单位级验收材料', levels: ['国家级', '地方级', '公司级'] },
  { key: 'company', label: '公司级验收材料', levels: ['国家级', '公司级'] },
  { key: 'local', label: '属地主管部门验收材料', levels: ['地方级'] },
  { key: 'national', label: '国家级验收材料', levels: ['国家级'] },
]
interface Precheck { ok: boolean; checks: { label: string; pass: boolean; detail: string }[] }

const SCORE_LABEL: Record<string, string> = { tech: '技术能力', quality: '交付质量', schedule: '进度履约', service: '服务配合', compliance: '合规性' }
export default function ProjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useSession()
  const toast = useToast()
  const [p, setP] = useState<ProjectFull | null>(null)
  const [tab, setTab] = useState('overview')
  // 业务动作弹窗
  const [baseOpen, setBaseOpen] = useState(false)
  const [baseForm, setBaseForm] = useState({ goal: '', yearGoal: '', partners: '' })
  const [filingOpen, setFilingOpen] = useState(false)
  const [filingUploaded, setFilingUploaded] = useState<Set<string>>(new Set())
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [precheck, setPrecheck] = useState<Precheck | null>(null)
  const [tierUploaded, setTierUploaded] = useState<Set<string>>(new Set())
  const [pkgOpen, setPkgOpen] = useState(false)
  const [pkgForm, setPkgForm] = useState<{ name: string; mode: string; form: string; planDate: string; brief: string; ids: Set<number> }>({ name: '', mode: '向型号转化', form: '装机', planDate: '', brief: '', ids: new Set() })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { api.get<ProjectFull>(`/projects/${id}`).then(setP) }, [id])
  useEffect(load, [load])

  const isTeam = user?.role === 'team'
  const canOperate = isTeam && p != null && [p.team.owner, p.team.tech, p.team.pm].includes(user!.name)

  const openAccept = async () => {
    setTierUploaded(new Set())
    setPrecheck(await api.get<Precheck>(`/projects/${id}/accept-precheck`))
    setAcceptOpen(true)
  }
  const doAction = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true)
    try { await fn(); toast(okMsg); setBaseOpen(false); setFilingOpen(false); setAcceptOpen(false); setPkgOpen(false); load() }
    catch (e) { toast((e as Error).message, 'err') }
    finally { setBusy(false) }
  }

  const phase = useMemo(() => {
    if (!p) return 0
    if (p.status === '申报中') return 0
    if (p.status === '立项中') return 1
    if (p.status === '实施中') return 2
    if (p.status === '验收中') return 3
    if (p.status === '已终止') return 2
    if (p.postEval?.status === '已完成') return 6
    if (p.postEval && p.postEval.status !== '待启动') return 5
    return 4
  }, [p])

  const fundsOpt = useMemo<EChartsOption>(() => {
    if (!p) return {}
    return {
      grid: { left: 56, right: 20, top: 38, bottom: 26 },
      legend: { top: 4, left: 6, data: ['年度预算', '年度支出'] },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: p.funds.map((f) => `${f.year}`) },
      yAxis: { type: 'value' },
      series: [
        { name: '年度预算', type: 'bar', barWidth: 20, itemStyle: { color: 'rgba(56,189,248,0.35)', borderRadius: [3, 3, 0, 0] }, data: p.funds.map((f) => f.budget) },
        { name: '年度支出', type: 'bar', barWidth: 20, itemStyle: { color: '#38BDF8', borderRadius: [3, 3, 0, 0] }, data: p.funds.map((f) => f.spent) },
      ],
    }
  }, [p])

  if (!p) return <div className="text-faint text-sm py-20 text-center">正在加载项目详情…</div>

  const spentRate = p.total_budget ? Math.round((p.spentAll / p.total_budget) * 100) : 0

  return (
    <div className="flex flex-col gap-4 fade-up">
      {/* 头部 */}
      <Card pad className="!p-5">
        <div className="flex items-start gap-4">
          <button aria-label="返回" onClick={() => nav(-1)} className="mt-1 p-1.5 rounded-lg text-dim hover:text-ink hover:bg-[rgba(148,163,184,0.1)] cursor-pointer"><ArrowLeft size={17} /></button>
          <div className="grow min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1.5">
              <h1 className="text-[19px] font-bold">{p.name}</h1>
              <FourBadge color={p.color} />
              <Tag tone={p.status === '已验收' ? 'green' : p.status === '验收中' ? 'yellow' : p.status === '已终止' ? 'dim' : 'accent'}>{p.status}</Tag>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-dim flex-wrap">
              <span className="num">{p.code}</span>
              {p.wbs && <span className="num text-faint">WBS {p.wbs}</span>}
              <Tag tone={p.level === '国家级' ? 'accent' : p.level === '地方级' ? 'violet' : 'dim'}>{p.level}</Tag>
              <span>{p.channelName}</span>
              <span>牵头：{p.unitShort}</span>
              <span className="num">{fmtDate(p.start)} – {fmtDate(p.end)}</span>
            </div>
          </div>
          <div className="flex gap-8 shrink-0 text-right">
            <div>
              <div className="text-[11px] text-faint mb-1">总经费</div>
              <div className="num text-[20px] font-semibold text-accent">{wan(p.total_budget)}<span className="text-[11px] text-faint ml-1">万元</span></div>
            </div>
            <div>
              <div className="text-[11px] text-faint mb-1">累计支出 <span className="num">{spentRate}%</span></div>
              <div className="num text-[20px] font-semibold">{wan(p.spentAll)}<span className="text-[11px] text-faint ml-1">万元</span></div>
            </div>
            <div>
              <div className="text-[11px] text-faint mb-1">里程碑 {p.msDone}/{p.msTotal}</div>
              <div className="w-[110px] mt-3"><Bar value={p.progress} color={FOUR_HEX[p.color]} /></div>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-line">
          <LifecycleDiagram active={phase} />
        </div>
        {canOperate && !['已验收', '已终止'].includes(p.status) && (
          <div className="mt-3 pt-3 border-t border-line flex items-center gap-2.5">
            <span className="text-[11px] text-faint mr-1">项目团队业务办理：</span>
            <Btn size="sm" onClick={() => { setBaseForm({ goal: p.goal || '', yearGoal: p.year_goal || '', partners: p.partners.map((x) => `${x.name}：${x.work || ''}`).join('\n') }); setBaseOpen(true) }}>完善基本信息</Btn>
            {p.status === '立项中' && <Btn size="sm" variant="primary" onClick={() => { setFilingUploaded(new Set()); setFilingOpen(true) }}>提交立项备案</Btn>}
            {p.status === '实施中' && <Btn size="sm" variant="primary" onClick={openAccept}>发起验收申请</Btn>}
            {p.status === '草稿' && <Tag tone="yellow">草稿状态 · 可在审批中心「重新提交」恢复流转</Tag>}
          </div>
        )}
      </Card>

      <Tabs value={tab} onChange={setTab} items={[
        { key: 'overview', label: '概览' },
        { key: 'milestones', label: `里程碑 ${p.msDone}/${p.msTotal}` },
        { key: 'plans', label: `计划 ${p.plans.length}` },
        { key: 'funds', label: '经费' },
        { key: 'deliverables', label: `交付物 ${p.delivered}/${p.delivTotal}` },
        { key: 'collab', label: `协作评价 ${p.collaborators.length}` },
        { key: 'transform', label: `成果转化 ${p.packages.length}` },
        { key: 'records', label: '审批与归档' },
      ]} />

      {/* 概览 */}
      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          <Card title="项目信息" className="col-span-2">
            <DL cols={2} items={[
              ['项目目标', p.goal],
              ['年度目标', p.year_goal || '—'],
              ['立项部门', p.channelName], ['渠道流程', <span key="f" className="flex flex-wrap gap-1.5">{p.channelFlow.map((s, i) => <Tag key={i}>{s}</Tag>)}</span>],
              ['成果转化状态', p.transform_status || '—'],
              ['协作单位', p.partners.length ? (
                <span className="flex flex-col gap-1">{p.partners.map((x, i) => <span key={i} className="text-[12.5px]"><b>{x.name}</b><span className="text-faint"> · {x.work || '联合研制'}</span></span>)}</span>
              ) : '—'],
            ]} />
          </Card>
          <Card title="项目团队">
            <div className="flex flex-col gap-3">
              {[['项目负责人', p.team.owner], ['技术负责人', p.team.tech], ['项目主管', p.team.pm],
                ['一级总师', p.team.chief1], ['二级总师', p.team.chief2],
                ['总部处室处长', p.team.hqHead], ['单位科技部长', p.team.unitDeptHead], ['单位财务主管', p.team.finStaff],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.22)] text-accent text-[11px] font-semibold flex items-center justify-center shrink-0">{(v as string).slice(0, 1)}</span>
                  <span className="text-[12.5px]">{v}</span>
                  <span className="text-[11px] text-faint ml-auto">{k}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 里程碑 */}
      {tab === 'milestones' && (
        <Card title="年度里程碑（四色闭环管理）" extra={<span className="text-[11px] text-faint">超期需经【项目变更】延期审批 · 完成须上传佐证销项</span>}>
          {p.milestones.length === 0 && <Empty text="立项后填报年度里程碑清单" />}
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-line2" />
            {p.milestones.map((m) => (
              <div key={m.id} className="relative pb-5 last:pb-0">
                <span className="absolute -left-6 top-1" style={{ filter: m.color === 'red' ? 'drop-shadow(0 0 4px rgba(248,113,113,0.8))' : undefined }}>
                  <StatusDot color={m.color} pulse={m.color === 'red'} />
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[13px] font-medium">{m.seq}. {m.title}</span>
                  <FourBadge color={m.color} label={FOUR_LABEL[m.color]} />
                  <span className="num text-[11.5px] text-faint">计划 {fmtDate(m.due)}</span>
                  {m.done_at && <span className="num text-[11.5px] text-sgreen">完成 {fmtDate(m.done_at)}</span>}
                  {!m.done_at && <span className={`num text-[11.5px] ${m.color === 'red' ? 'text-sred' : m.color === 'yellow' ? 'text-syellow' : 'text-faint'}`}>{daysText(m.daysLeft)}</span>}
                </div>
                {m.evidence && <div className="text-[11.5px] text-faint mt-1 flex items-center gap-1.5"><Paperclip size={11} />{m.evidence}</div>}
                {m.delay_reason && <div className="text-[11.5px] text-sred mt-1">滞后原因：{m.delay_reason}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 计划 */}
      {tab === 'plans' && (
        <Card title="计划管理（CMOS 自动同步）" extra={<Tag tone="accent">CMOS 已同步</Tag>} pad={false}>
          <table className="dtable">
            <thead><tr><th>计划内容</th><th>来源</th><th>完成时限</th><th>状态</th><th>完成时间</th></tr></thead>
            <tbody>
              {p.plans.map((x) => (
                <tr key={x.id}>
                  <td className="max-w-[420px] truncate">{x.title}</td>
                  <td><Tag>{x.source}</Tag></td>
                  <td className="num text-dim">{fmtDate(x.due)}</td>
                  <td><FourBadge color={x.color} label={x.status} /></td>
                  <td className="num text-dim">{fmtDate(x.done_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.plans.length === 0 && <Empty />}
        </Card>
      )}

      {/* 经费 */}
      {tab === 'funds' && (
        <div className="grid grid-cols-5 gap-4">
          <Card title="年度预算与执行（万元）" pad={false} className="col-span-3">
            <EChart option={fundsOpt} height={280} />
          </Card>
          <Card title="核销记录（付款凭证）" pad={false} className="col-span-2">
            <div className="max-h-[280px] overflow-y-auto">
              <table className="dtable">
                <thead><tr><th>日期</th><th>凭证号</th><th>用途</th><th className="text-right">金额(万)</th></tr></thead>
                <tbody>
                  {p.funds.flatMap((f) => f.writeoffs.map((w, i) => (
                    <tr key={`${f.year}-${i}`}>
                      <td className="num text-dim">{fmtDate(w.date)}</td>
                      <td className="num text-[11px] text-faint">{w.voucher}</td>
                      <td className="text-dim">{w.note}</td>
                      <td className="num text-right">{wan(w.amount, 1)}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 交付物 */}
      {tab === 'deliverables' && (
        <Card title="交付物台账（与立项考核指标一一对应）" pad={false}>
          <table className="dtable">
            <thead><tr><th>交付物名称</th><th>类型</th><th>交付状态</th><th>约定期限</th><th>实际交付</th><th>权属</th><th>对应成果编号</th></tr></thead>
            <tbody>
              {p.deliverables.map((dd) => {
                const pkg = p.packages.find((k) => k.id === dd.package_id)
                return (
                  <tr key={dd.id}>
                    <td className="max-w-[320px] truncate font-medium">{dd.name}</td>
                    <td><Tag>{dd.type}</Tag></td>
                    <td><FourBadge color={dd.color} label={dd.delivered_at ? '已交付' : dd.color === 'red' ? '已逾期' : '待交付'} /></td>
                    <td className="num text-dim">{fmtDate(dd.due)}</td>
                    <td className="num text-dim">{fmtDate(dd.delivered_at)}</td>
                    <td className="text-dim text-[11.5px]">{dd.owner}</td>
                    <td className="num text-[11.5px]">{pkg ? <span className="text-accent">{pkg.code}</span> : <span className="text-faint">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {p.deliverables.length === 0 && <Empty text="任务书约定交付物将在此归集" />}
        </Card>
      )}

      {/* 协作评价 */}
      {tab === 'collab' && (
        <div className="grid grid-cols-2 gap-4">
          {p.collaborators.length === 0 && <Card><Empty text="暂无协作单位" /></Card>}
          {p.collaborators.map((c) => (
            <Card key={c.id} title={<span className="flex items-center gap-2">{c.name}{c.blacklisted === 1 && <Tag tone="red">黑名单</Tag>}</span>}
              extra={<Tag tone={c.ctype === '参研' ? 'accent' : 'dim'}>{c.ctype}单位</Tag>}>
              {c.scores ? (
                <div className="flex items-start gap-6">
                  <div className="text-center shrink-0 pt-1">
                    <div className={`num text-[30px] font-bold leading-9 ${c.total! >= 90 ? 'text-sgreen' : c.total! >= 60 ? 'text-accent' : 'text-sred'}`}>{c.total}</div>
                    <Tag tone={c.grade === '优秀' ? 'green' : c.grade === '不合格' ? 'red' : c.grade === '良好' ? 'accent' : 'dim'}>{c.grade}</Tag>
                    <div className="text-[10.5px] text-faint mt-1.5 num">{fmtDate(c.eval_date)}</div>
                  </div>
                  <div className="grow flex flex-col gap-2">
                    {Object.entries(c.scores).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2.5">
                        <span className="text-[11.5px] text-dim w-14 shrink-0">{SCORE_LABEL[k]}</span>
                        <div className="grow"><Bar value={v} color={v >= 90 ? '#34D399' : v >= 60 ? '#38BDF8' : '#F87171'} height={5} /></div>
                        <span className="num text-[11.5px] w-7 text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-faint py-3">待评价 · {c.ctype === '参研' ? '项目验收完成后 30 日内' : '外协合同验收后 30 日内'}完成五维评分</div>
              )}
              {c.note && <div className="text-[11.5px] text-sred mt-3 pt-3 border-t border-line leading-5">{c.note}</div>}
            </Card>
          ))}
        </div>
      )}

      {/* 成果转化 */}
      {tab === 'transform' && (
        <div className="grid grid-cols-2 gap-4">
          {(canOperate || user?.role === 'mgmt') && p.deliverables.some((x) => x.delivered_at) && (
            <div className="col-span-2 flex justify-end">
              <Btn size="sm" variant="primary" onClick={() => { setPkgForm({ name: '', mode: '向型号转化', form: '装机', planDate: '', brief: '', ids: new Set() }); setPkgOpen(true) }}>
                <Plus size={13} />新建成果包
              </Btn>
            </div>
          )}
          {p.packages.length === 0 && <Card><Empty text="仅「已交付」交付物可打包纳入成果转化" /></Card>}
          {p.packages.map((k) => (
            <Card key={k.id} title={<span className="flex items-center gap-2"><span className="num text-accent text-[12px]">{k.code}</span>{k.name}</span>}
              extra={<FourBadge color={k.color} label={k.status} />}>
              <DL cols={3} items={[
                ['转化方式', k.mode], ['转化形式', k.form], ['关联交付物', `${k.deliverableCount} 项`],
                ['计划转化时间', fmtDate(k.plan_date)], ['实际转化时间', fmtDate(k.actual_date)], ['责任单位', p.unitShort],
              ]} />
              <p className="text-[12px] text-dim leading-5 mt-3">{k.brief}</p>
              {k.detail && <p className="text-[11.5px] text-faint leading-5 mt-1.5">{k.detail}</p>}
            </Card>
          ))}
        </div>
      )}

      {/* 审批与归档 */}
      {tab === 'records' && (
        <div className="grid grid-cols-2 gap-4">
          <Card title="审批记录" pad={false}>
            <div className="max-h-[520px] overflow-y-auto">
              {p.approvals.length === 0 && <Empty text="暂无审批流程" />}
              {p.approvals.map((a) => (
                <div key={a.id} className="px-4 py-3 hairline-b">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Tag tone={a.status === '已通过' ? 'green' : a.status === '已驳回' ? 'red' : 'accent'}>{a.status}</Tag>
                    <span className="text-[12.5px] font-medium truncate">{a.title}</span>
                  </div>
                  <StepLine steps={a.steps} />
                </div>
              ))}
            </div>
          </Card>
          <Card title="全周期文档归档" pad={false}>
            <div className="max-h-[520px] overflow-y-auto">
              {['申报', '立项', '实施', '验收', '成果转化'].map((ph) => {
                const docs = p.documents.filter((x) => x.phase === ph)
                if (!docs.length) return null
                return (
                  <div key={ph} className="px-4 py-3 hairline-b">
                    <div className="text-[11px] tracking-wider text-faint mb-2">{ph}阶段</div>
                    {docs.map((x) => (
                      <div key={x.id} className="flex items-center gap-2.5 py-1.5">
                        <FileText size={13} className="text-accent shrink-0" />
                        <span className="text-[12.5px] truncate grow">{x.name}</span>
                        {x.file_path && (
                          <a href={`/api/documents/${x.id}/file`} download
                            className="text-[10.5px] text-accent hover:underline shrink-0 flex items-center gap-1">
                            <Download size={11} />下载原件
                          </a>
                        )}
                        <span className="text-[10.5px] text-faint num shrink-0">{x.uploader} · {fmtDate(x.uploaded_at)} · {x.size_kb >= 1024 ? `${(x.size_kb / 1024).toFixed(1)}MB` : `${x.size_kb}KB`}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
      {/* ==== 业务动作弹窗 ==== */}
      <Modal open={baseOpen} onClose={() => setBaseOpen(false)} title="完善项目基本信息（分级审批后回写台账）" width={600}>
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint">审批链：项目团队填写 → 项目负责人 → 单位科技管理部 → 单位分管领导 → 总部科研项目处；通过后自动同步项目台账。层级/渠道等立项要素不可在此修改（需走数据变更）。</div>
          <Field label="项目目标"><Textarea rows={3} value={baseForm.goal} onChange={(e) => setBaseForm({ ...baseForm, goal: e.target.value })} /></Field>
          <Field label="年度目标"><Input value={baseForm.yearGoal} onChange={(e) => setBaseForm({ ...baseForm, yearGoal: e.target.value })} /></Field>
          <Field label="参研单位及分工" hint="每行一条，格式：单位名称：主要工作内容">
            <Textarea rows={3} value={baseForm.partners} onChange={(e) => setBaseForm({ ...baseForm, partners: e.target.value })} />
          </Field>
          <Field label="项目层级（锁定）">
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-night2 border border-line text-[13px] text-faint">
              <Lock size={13} />{p.level} · 立项后原则上不允许变更，特殊情况须走「数据变更」审批
            </div>
          </Field>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setBaseOpen(false)}>取消</Btn>
            <Btn variant="primary" disabled={busy} onClick={() => doAction(() => api.post(`/projects/${p.id}/baseinfo`, {
              goal: baseForm.goal, yearGoal: baseForm.yearGoal,
              partners: baseForm.partners.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const [n2, w] = l.split(/[：:]/); return { name: n2.trim(), work: (w || '').trim() } }),
            }), '基本信息补充已提交，二级单位内部审核中')}>提交审核</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={filingOpen} onClose={() => setFilingOpen(false)} title={`提交立项备案（${p.channelName}）`} width={540}>
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint">按渠道上传盖章版立项佐证材料，提交总部备案归档；备案通过后项目进入实施阶段。</div>
          <div className="flex flex-col gap-2">
            {(p.channelFlow.length ? channelFilingMaterials(p) : []).map((m) => {
              const on = filingUploaded.has(m)
              return (
                <button key={m} onClick={() => { const n2 = new Set(filingUploaded); if (on) n2.delete(m); else n2.add(m); setFilingUploaded(n2) }}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left cursor-pointer transition-all ${on ? 'border-[rgba(52,211,153,0.4)] bg-[rgba(52,211,153,0.07)]' : 'border-line2 hover:border-[rgba(56,189,248,0.4)]'}`}>
                  {on ? <CheckCircle2 size={15} className="text-sgreen shrink-0" /> : <FileUp size={15} className="text-dim shrink-0" />}
                  <span className="text-[12.5px] grow">{m}（盖章版）</span>
                  <span className={`text-[10.5px] num ${on ? 'text-sgreen' : 'text-faint'}`}>{on ? '已上传' : '点击模拟上传'}</span>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setFilingOpen(false)}>取消</Btn>
            <Btn variant="primary" disabled={busy || filingUploaded.size < channelFilingMaterials(p).length}
              onClick={() => doAction(() => api.post(`/projects/${p.id}/filing`, { materials: [...filingUploaded] }), '立项备案已提交总部归档')}>
              提交备案
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal open={acceptOpen} onClose={() => setAcceptOpen(false)} title={`发起验收申请（${p.level} · 分级验收）`} width={640}>
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[12px] text-dim mb-2">前置条件强校验（不满足无法提交）</div>
            <div className="flex flex-col gap-1.5">
              {precheck?.checks.map((c) => (
                <div key={c.label} className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border ${c.pass ? 'border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.05)]' : 'border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.06)]'}`}>
                  {c.pass ? <CheckCircle2 size={15} className="text-sgreen shrink-0 mt-0.5" /> : <XCircle size={15} className="text-sred shrink-0 mt-0.5" />}
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium">{c.label}</span>
                    <span className={`block text-[11px] mt-0.5 ${c.pass ? 'text-faint' : 'text-sred'}`}>{c.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[12px] text-dim mb-2">分级验收材料（系统按项目层级自动匹配，非本层级栏目锁定）</div>
            <div className="flex flex-col gap-1.5">
              {TIERS.map((t) => {
                const open = t.levels.includes(p.level)
                const on = tierUploaded.has(t.key)
                return open ? (
                  <button key={t.key} onClick={() => { const n2 = new Set(tierUploaded); if (on) n2.delete(t.key); else n2.add(t.key); setTierUploaded(n2) }}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left cursor-pointer transition-all ${on ? 'border-[rgba(52,211,153,0.4)] bg-[rgba(52,211,153,0.07)]' : 'border-line2 hover:border-[rgba(56,189,248,0.4)]'}`}>
                    {on ? <CheckCircle2 size={15} className="text-sgreen shrink-0" /> : <FileUp size={15} className="text-dim shrink-0" />}
                    <span className="text-[12.5px] grow">{t.label}</span>
                    <span className={`text-[10.5px] num ${on ? 'text-sgreen' : 'text-faint'}`}>{on ? '已上传' : '点击模拟上传'}</span>
                  </button>
                ) : (
                  <div key={t.key} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-line bg-night2 opacity-50 cursor-not-allowed" title={`${p.level}项目无需此层级验收`}>
                    <Lock size={14} className="text-faint shrink-0" />
                    <span className="text-[12.5px] grow text-faint">{t.label}</span>
                    <span className="text-[10.5px] text-faint">非本层级 · 锁定</span>
                  </div>
                )
              })}
            </div>
          </div>
          {p.level === '国家级' && <div className="text-[11px] text-faint">国家级项目验收流程自动增加「责任总师技术复核」环节。验收办结后 30 日内须完成参研单位评价。</div>}
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setAcceptOpen(false)}>取消</Btn>
            <Btn variant="primary" disabled={busy || !precheck?.ok || tierUploaded.size < TIERS.filter((t) => t.levels.includes(p.level)).length}
              onClick={() => doAction(() => api.post(`/projects/${p.id}/accept-request`, { tiers: [...tierUploaded] }), '验收申请已提交，进入分级验收流程')}>
              {precheck?.ok ? '提交验收申请' : '前置条件未满足'}
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal open={pkgOpen} onClose={() => setPkgOpen(false)} title="新建成果包（仅「已交付」交付物可纳入）" width={620}>
        <div className="flex flex-col gap-4">
          <Field label="成果包名称" required><Input placeholder="如：损伤容限评估软件成果包" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} /></Field>
          <div>
            <div className="text-[12px] text-dim mb-2">选择关联交付物（多项可打包对应一项转化）</div>
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
              {p.deliverables.map((dRow) => {
                const delivered = !!dRow.delivered_at
                const on = pkgForm.ids.has(dRow.id)
                return delivered ? (
                  <button key={dRow.id} onClick={() => { const n2 = new Set(pkgForm.ids); if (on) n2.delete(dRow.id); else n2.add(dRow.id); setPkgForm({ ...pkgForm, ids: n2 }) }}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-left cursor-pointer transition-all ${on ? 'border-[rgba(56,189,248,0.5)] bg-[rgba(56,189,248,0.07)]' : 'border-line2 hover:border-[rgba(56,189,248,0.35)]'}`}>
                    <CheckCircle2 size={14} className={on ? 'text-accent shrink-0' : 'text-faint shrink-0'} />
                    <span className="text-[12.5px] grow truncate">{dRow.name}</span>
                    <Tag>{dRow.type}</Tag>
                  </button>
                ) : (
                  <div key={dRow.id} className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-line bg-night2 opacity-50 cursor-not-allowed" title="未交付成果禁止绑定转化台账">
                    <Lock size={13} className="text-faint shrink-0" />
                    <span className="text-[12.5px] grow truncate text-faint">{dRow.name}</span>
                    <span className="text-[10.5px] text-faint">未交付 · 锁定</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="转化方式">
              <Select value={pkgForm.mode} onChange={(e) => setPkgForm({ ...pkgForm, mode: e.target.value, form: e.target.value === '向型号转化' ? '装机' : '转让' })}>
                <option>向型号转化</option><option>向市场转化</option>
              </Select>
            </Field>
            <Field label="转化形式（联动）">
              <Select value={pkgForm.form} onChange={(e) => setPkgForm({ ...pkgForm, form: e.target.value })}>
                {(pkgForm.mode === '向型号转化' ? ['装机', '未装机'] : ['转让', '许可', '联合实施', '作价投资', '其他']).map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>
            <Field label="计划转化时间"><Input type="date" value={pkgForm.planDate} onChange={(e) => setPkgForm({ ...pkgForm, planDate: e.target.value })} /></Field>
          </div>
          <Field label="成果简介" hint="100 字以内，描述核心技术内容与应用价值"><Textarea rows={2} value={pkgForm.brief} onChange={(e) => setPkgForm({ ...pkgForm, brief: e.target.value })} /></Field>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setPkgOpen(false)}>取消</Btn>
            <Btn variant="primary" disabled={busy || !pkgForm.name.trim() || pkgForm.ids.size === 0}
              onClick={() => doAction(() => api.post(`/projects/${p.id}/packages`, { name: pkgForm.name.trim(), deliverableIds: [...pkgForm.ids], mode: pkgForm.mode, form: pkgForm.form, planDate: pkgForm.planDate || undefined, brief: pkgForm.brief }), '成果包已创建并提交转化备案')}>
              创建成果包（{pkgForm.ids.size} 项交付物）
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/** 渠道立项材料（渠道未定义时给通用项） */
function channelFilingMaterials(p: ProjectFull): string[] {
  return p.channelFiling && p.channelFiling.length ? p.channelFiling : ['立项批复/立项通知', '任务书']
}

/** 审批步骤条（横向紧凑型） */
export function StepLine({ steps }: { steps: ApprovalStep[] }) {
  return (
    <div className="flex items-center flex-wrap gap-y-1">
      {steps.map((s, i) => (
        <span key={i} className="flex items-center">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] whitespace-nowrap ${
            s.status === 'approved' ? 'text-sgreen' : s.status === 'current' ? 'text-accent bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.3)]' : s.status === 'rejected' ? 'text-sred' : 'text-faint'
          }`} title={s.comment || undefined}>
            {s.status === 'approved' ? '✓' : s.status === 'rejected' ? '✕' : ''} {s.title}
          </span>
          {i < steps.length - 1 && <span className="text-faint text-[10px] mx-0.5">→</span>}
        </span>
      ))}
    </div>
  )
}
