import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, FileUp, ChevronLeft, Sparkles, FileText, X, Plus, LoaderCircle, TriangleAlert, Search } from 'lucide-react'
import { api, apiUpload } from '../../api/client'
import { useSession } from '../../store/session'
import type { Channel } from '../../store/session'
import type { DuplicateMatch } from '../../api/types'
import { Btn, Card, Field, Input, Modal, Select, Tag, Textarea, useToast } from '../../components/ui'

const LEVEL_TONE: Record<string, 'accent' | 'violet' | 'dim'> = { 国家级: 'accent', 地方级: 'violet', 公司级: 'dim' }
const DELIV_TYPES = ['专利', '论文', '软著', '技术标准', '原理样机', '设备', '成套技术成果']

interface ExtractFields {
  name?: string; goal?: string; yearGoal?: string; budget?: number
  start?: string; end?: string; channelGuess?: string
  owner?: string; tech?: string; summary?: string
  partners?: { name: string; work?: string }[]
  milestones?: { title: string; due?: string }[]
  deliverables?: { name: string; type?: string }[]
}
interface AiStatus { configured: boolean; provider: string; model: string }
interface MsRow { title: string; due: string }
interface DlRow { name: string; type: string }

export default function Declare() {
  const { boot, user, unitOf, channelOf } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(0)
  const [ch, setCh] = useState<Channel | null>(null)
  const [form, setForm] = useState({ name: '', goal: '', budget: '', start: '2026-09-01', end: '2029-08-31', partners: '' })
  const [uploaded, setUploaded] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<{ code: string; projectId: number } | null>(null)
  const [busy, setBusy] = useState(false)
  // AI 识读状态
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [srcFile, setSrcFile] = useState<{ id: number; name: string } | null>(null)
  const [aiMeta, setAiMeta] = useState<{ provider: string; model: string; summary?: string } | null>(null)
  const [ms, setMs] = useState<MsRow[]>([])
  const [dl, setDl] = useState<DlRow[]>([])
  const [flashMat, setFlashMat] = useState(false)
  const [dupOpen, setDupOpen] = useState(false)
  const [dupBusy, setDupBusy] = useState(false)
  const [dupMatches, setDupMatches] = useState<DuplicateMatch[]>([])
  const [dupAlgorithm, setDupAlgorithm] = useState('')

  useEffect(() => { api.get<AiStatus>('/ai/status').then(setAi).catch(() => {}) }, [])

  const grouped = useMemo(() => {
    const g: Record<string, Channel[]> = {}
    for (const c of (boot?.channels || []).filter((x) => x.enabled !== 0)) (g[c.level] ||= []).push(c)
    return g
  }, [boot])

  const missing = useMemo(() => (ch ? ch.declare.filter((m) => !uploaded.has(m)) : []), [ch, uploaded])

  /** 未选渠道时拦截上传：先选渠道，材料栏目与审签链才能确定 */
  const guardPick = () => {
    if (!ch) {
      toast('请先在下方选择立项渠道，再上传申报书进行 AI 识读（识读结果需匹配渠道的材料栏目与审签流程）', 'err')
      return false
    }
    return true
  }

  const tryNext = () => {
    if (!form.name.trim()) { toast('请先填写项目名称', 'err'); return }
    if (missing.length) {
      toast(`还有 ${missing.length} 项申报材料未上传：${missing.join('、')}`, 'err')
      setFlashMat(true)
      window.setTimeout(() => setFlashMat(false), 1500)
      return
    }
    setStep(2)
  }

  const checkDuplicate = async () => {
    if (!form.name.trim()) { toast('请先填写项目名称再查重', 'err'); return }
    setDupBusy(true)
    try {
      const r = await api.post<{ matches: DuplicateMatch[]; algorithm: string }>('/project-duplicates', {
        name: form.name,
        channelId: ch?.id,
        level: ch?.level,
        leadUnitId: user?.unit_id,
        owner: user?.name,
        keywords: form.goal,
      })
      setDupMatches(r.matches)
      setDupAlgorithm(r.algorithm)
      setDupOpen(true)
      toast(r.matches.length ? `查重完成：命中 ${r.matches.length} 条疑似项目` : '查重完成：暂未发现疑似重复项目')
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setDupBusy(false)
    }
  }

  const onPickFile = async (f: File | null) => {
    if (!f) return
    setAiBusy(true)
    try {
      const up = await apiUpload(f)
      setSrcFile({ id: up.id, name: up.name })
      const r = await api.post<{ fields: ExtractFields; provider: string; model: string }>(`/uploads/${up.id}/extract`)
      const x = r.fields
      setAiMeta({ provider: r.provider, model: r.model, summary: x.summary })
      setForm((old) => ({
        name: x.name || old.name,
        goal: x.goal || old.goal,
        budget: x.budget != null ? String(x.budget) : old.budget,
        start: x.start || old.start,
        end: x.end || old.end,
        partners: x.partners?.length ? x.partners.map((p) => p.name).join('、') : old.partners,
      }))
      setMs((x.milestones || []).map((m) => ({ title: m.title, due: m.due || '' })))
      setDl((x.deliverables || []).map((d) => ({ name: d.name, type: d.type && DELIV_TYPES.includes(d.type) ? d.type : '成套技术成果' })))
      // 渠道以用户选择为准；AI 判定不一致时仅提示核对，不自动切换
      const guess = x.channelGuess && (boot?.channels || []).find((c) => c.name === x.channelGuess || x.channelGuess!.includes(c.name) || c.name.includes(x.channelGuess!))
      setStep(1)
      if (guess && ch && guess.id !== ch.id) {
        toast(`识别完成并已预填。注意：AI 判定该文档更符合「${guess.name}」渠道，与当前所选「${ch.name}」不一致，请核对`, 'err')
      } else {
        toast('识别完成：表单与里程碑/交付物已预填，请核对修改')
      }
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setAiBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = async () => {
    if (!ch) return
    setBusy(true)
    try {
      const r = await api.post<{ code: string; projectId: number }>('/declarations', {
        name: form.name.trim(), channelId: ch.id, goal: form.goal, budget: Number(form.budget) || 0,
        start: form.start, end: form.end,
        partners: form.partners.split(/[，,、\s]+/).filter(Boolean),
        materials: ch.declare,
        uploadId: srcFile?.id,
        milestones: ms.filter((m) => m.title.trim()),
        deliverables: dl.filter((d) => d.name.trim()),
      })
      setResult(r); setStep(3)
      toast('申报已提交，审签流程已生成')
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4 fade-up max-w-[1100px]">
      {/* 步骤指示 */}
      <div className="flex items-center gap-2">
        {['选择立项渠道', '填报与材料上传', '确认提交', '完成'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] num border ${
              i < step ? 'bg-[rgba(52,211,153,0.15)] border-sgreen text-sgreen' : i === step ? 'bg-[rgba(56,189,248,0.15)] border-accent text-accent' : 'border-line2 text-faint'}`}>
              {i < step ? '✓' : i + 1}
            </span>
            <span className={`text-[12.5px] ${i === step ? 'text-ink font-medium' : 'text-faint'}`}>{s}</span>
            {i < 3 && <span className="w-8 h-px bg-line2 mx-1" />}
          </div>
        ))}
      </div>

      {/* AI 识读入口（贯穿 0/1 两步展示） */}
      {step <= 1 && (
        <div className={`card !border-dashed px-5 py-4 flex items-center gap-4 ${aiBusy ? 'opacity-80' : ''}`}
          style={{ borderColor: 'rgba(56,189,248,0.35)' }}>
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-accent bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.25)]">
            {aiBusy ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
          </span>
          <div className="grow min-w-0">
            <div className="text-[13px] font-semibold flex items-center gap-2.5 flex-wrap">
              已有申报书？上传原件，AI 自动识读并填充表单
              {ai && (ai.configured
                ? <Tag tone="accent">AI 识读 · {ai.model}</Tag>
                : <Tag tone="yellow">未配置 AI 密钥 · 当前为本地规则模拟解析</Tag>)}
            </div>
            <div className="text-[11.5px] text-faint mt-0.5">
              支持 PDF / DOCX / TXT，原件同步存档至项目文档库；识别结果仅作预填，提交前均可修改
              {srcFile && <span className="text-sgreen"> · 已归档：{srcFile.name}</span>}
            </div>
            {!ch && (
              <div className="flex items-center gap-1.5 text-[11.5px] text-syellow mt-1.5">
                <TriangleAlert size={13} />
                请先在下方选择立项渠道，再上传识读——材料栏目与审签流程随渠道确定
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)} />
          <Btn variant="primary" disabled={aiBusy} onClick={() => { if (guardPick()) fileRef.current?.click() }}>
            <FileUp size={14} />{aiBusy ? '解析中…' : srcFile ? '重新上传' : '上传并识读'}
          </Btn>
        </div>
      )}

      {/* Step 0: 渠道选择 */}
      {step === 0 && (
        <>
          <div className="text-[12px] text-faint">按项目来源规则触发差异化填报内容与审签流程 · 非本渠道所需材料字段将锁定不可编辑</div>
          {(['国家级', '地方级', '公司级'] as const).map((lv) => (
            <div key={lv}>
              <div className="flex items-center gap-2 mb-2.5 mt-1">
                <Tag tone={LEVEL_TONE[lv]}>{lv}</Tag>
                <span className="text-[11px] text-faint">{grouped[lv]?.length || 0} 条渠道</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(grouped[lv] || []).map((c) => (
                  <button key={c.id} onClick={() => { setCh(c); setUploaded(new Set()); setStep(1) }}
                    className={`card text-left p-4 cursor-pointer transition-all duration-150 hover:border-[rgba(56,189,248,0.5)] hover:bg-[rgba(56,189,248,0.05)] ${ch?.id === c.id ? 'border-accent' : ''}`}>
                    <div className="text-[13px] font-semibold mb-1 truncate flex items-center gap-1.5">
                      <span className="truncate">{c.name}</span>
                      {c.declare_mode === '报备' && <Tag tone="green">报备类</Tag>}
                    </div>
                    <div className="text-[10.5px] text-faint mb-2">{c.org}{c.declare_mode === '报备' ? ' · 单位审批后归档，总部备案可溯' : ''}</div>
                    <div className="text-[10.5px] text-dim leading-4 line-clamp-2">{c.flow.slice(0, 4).join(' → ')}{c.flow.length > 4 ? ' → …' : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Step 1: 填报 */}
      {step === 1 && ch && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 flex flex-col gap-4">
            <Card title="项目基本信息">
              <div className="flex flex-col gap-4">
                <Field label="项目名称" required>
                  <div className="flex gap-2">
                    <Input placeholder="按立项文件全称填写" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <Btn disabled={dupBusy} onClick={checkDuplicate}><Search size={14} />{dupBusy ? '查重中…' : '项目查重'}</Btn>
                  </div>
                </Field>
                <Field label="项目目标"><Textarea rows={3} placeholder="项目整体目标…" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="申请经费（万元）"><Input type="number" inputMode="numeric" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
                  <Field label="开始时间"><Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
                  <Field label="结束时间"><Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
                </div>
                <Field label="参研单位" hint="多个单位以顿号/逗号分隔"><Input placeholder="如：北研中心、南京航空航天大学" value={form.partners} onChange={(e) => setForm({ ...form, partners: e.target.value })} /></Field>
              </div>
            </Card>

            {/* AI 识读结果：里程碑与交付物（可编辑） */}
            {(ms.length > 0 || dl.length > 0 || aiMeta) && (
              <Card title="AI 识读 · 里程碑与交付物（提交前可修改）"
                extra={aiMeta && <Tag tone={aiMeta.provider === 'mock' ? 'yellow' : 'accent'}>{aiMeta.provider === 'mock' ? '模拟解析' : aiMeta.model}</Tag>}>
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] tracking-wider text-faint">里程碑（{ms.length}）</div>
                  {ms.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={m.title} onChange={(e) => setMs(ms.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                      <Input type="date" style={{ width: 150 }} value={m.due} onChange={(e) => setMs(ms.map((x, j) => j === i ? { ...x, due: e.target.value } : x))} />
                      <button aria-label="删除里程碑" className="p-1.5 text-faint hover:text-sred cursor-pointer" onClick={() => setMs(ms.filter((_, j) => j !== i))}><X size={14} /></button>
                    </div>
                  ))}
                  <Btn size="sm" className="self-start" onClick={() => setMs([...ms, { title: '', due: '' }])}><Plus size={13} />添加里程碑</Btn>

                  <div className="text-[11px] tracking-wider text-faint mt-3">交付物（{dl.length}）</div>
                  {dl.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={d.name} onChange={(e) => setDl(dl.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <Select style={{ width: 150 }} value={d.type} onChange={(e) => setDl(dl.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}>
                        {DELIV_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </Select>
                      <button aria-label="删除交付物" className="p-1.5 text-faint hover:text-sred cursor-pointer" onClick={() => setDl(dl.filter((_, j) => j !== i))}><X size={14} /></button>
                    </div>
                  ))}
                  <Btn size="sm" className="self-start" onClick={() => setDl([...dl, { name: '', type: '成套技术成果' }])}><Plus size={13} />添加交付物</Btn>
                </div>
              </Card>
            )}
          </div>

          <div className="col-span-2 flex flex-col gap-4">
            <Card title={`申报材料（${ch.name}）`} className={flashMat ? 'flash-attn' : ''}
              extra={<Tag tone={missing.length ? 'yellow' : 'green'}>{uploaded.size}/{ch.declare.length} 已上传</Tag>}>
              <div className="text-[11px] text-faint mb-3">系统按所选渠道自适应展示材料栏目，全部上传后方可提交</div>
              <div className="flex flex-col gap-2">
                {ch.declare.map((m) => {
                  const on = uploaded.has(m)
                  return (
                    <button key={m} onClick={() => { const n = new Set(uploaded); if (on) n.delete(m); else n.add(m); setUploaded(n) }}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        on ? 'border-[rgba(52,211,153,0.4)] bg-[rgba(52,211,153,0.07)]' : 'border-line2 hover:border-[rgba(56,189,248,0.4)]'}`}>
                      {on ? <CheckCircle2 size={15} className="text-sgreen shrink-0" /> : <FileUp size={15} className="text-dim shrink-0" />}
                      <span className="text-[12.5px] grow">{m}</span>
                      <span className={`text-[10.5px] num ${on ? 'text-sgreen' : 'text-faint'}`}>{on ? `${m}.pdf · 已上传` : '点击模拟上传'}</span>
                    </button>
                  )
                })}
                {srcFile && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.05)]">
                    <FileText size={15} className="text-accent shrink-0" />
                    <span className="text-[12.5px] grow truncate">申报书原件 · {srcFile.name}</span>
                    <span className="text-[10.5px] num text-accent shrink-0">已真实归档</span>
                  </div>
                )}
              </div>
              {missing.length > 0 ? (
                <div className="flex items-start gap-2 mt-3 px-3.5 py-2.5 rounded-lg text-[12px] leading-5 text-syellow bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.32)]">
                  <TriangleAlert size={14} className="shrink-0 mt-0.5" />
                  <span>还差 <b className="num">{missing.length}</b> 项材料未上传：<b>{missing.join('、')}</b>。全部上传后方可进入下一步（演示环境点击对应条目即完成模拟上传）。</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-3 px-3.5 py-2.5 rounded-lg text-[12px] text-sgreen bg-[rgba(52,211,153,0.07)] border border-[rgba(52,211,153,0.3)]">
                  <CheckCircle2 size={14} className="shrink-0" />
                  申报材料已齐全，可进入下一步确认提交
                </div>
              )}
            </Card>
            <Card title="审签流程预览">
              <div className="flex flex-wrap items-center gap-y-1.5 text-[11px]">
                {ch.chain.map((s, i) => (
                  <span key={i} className="flex items-center">
                    <span className="px-1.5 py-0.5 rounded bg-[rgba(148,163,184,0.08)] text-dim whitespace-nowrap">{s}</span>
                    {i < ch.chain.length - 1 && <span className="text-faint mx-1">→</span>}
                  </span>
                ))}
              </div>
              <div className="text-[10.5px] text-faint mt-2.5">余下线下流程由科技部办理报批 · 审批驳回自动退回填报节点并留痕</div>
            </Card>
            <div className="flex gap-2.5">
              <Btn onClick={() => setStep(0)}><ChevronLeft size={14} />重选渠道</Btn>
              <Btn variant="primary" className="grow" onClick={tryNext}>
                下一步 · 确认提交{missing.length ? `（材料 ${uploaded.size}/${ch.declare.length}）` : ''}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: 确认 */}
      {step === 2 && ch && (
        <Card title="提交确认" className="max-w-[720px]">
          <div className="flex flex-col gap-3 text-[13px]">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-faint text-[11.5px] block mb-0.5">项目名称</span>{form.name}</div>
              <div><span className="text-faint text-[11.5px] block mb-0.5">立项渠道</span>{ch.name}（{ch.level}）</div>
              <div><span className="text-faint text-[11.5px] block mb-0.5">申请经费</span><span className="num">{form.budget || 0}</span> 万元</div>
              <div><span className="text-faint text-[11.5px] block mb-0.5">项目周期</span><span className="num">{form.start} ~ {form.end}</span></div>
              {ms.length > 0 && <div><span className="text-faint text-[11.5px] block mb-0.5">预填里程碑</span>{ms.filter((m) => m.title.trim()).length} 项</div>}
              {dl.length > 0 && <div><span className="text-faint text-[11.5px] block mb-0.5">预填交付物</span>{dl.filter((d) => d.name.trim()).length} 项</div>}
            </div>
            <div>
              <span className="text-faint text-[11.5px] block mb-1.5">随附材料</span>
              <div className="flex gap-2 flex-wrap">
                {[...uploaded].map((m) => <Tag key={m} tone="green">{m}.pdf</Tag>)}
                {srcFile && <Tag tone="accent">申报书原件 · {srcFile.name}</Tag>}
              </div>
            </div>
            {aiMeta?.summary && <div className="text-[11.5px] text-dim bg-night2 border border-line rounded-lg px-3.5 py-2.5">AI 摘要：{aiMeta.summary}</div>}
            <div className="text-[11.5px] text-syellow bg-[rgba(251,191,36,0.07)] border border-[rgba(251,191,36,0.25)] rounded-lg px-3.5 py-2.5">
              提交后将进入线上审签流程，流程中仅填报人可发起撤销；撤销后回归草稿状态并永久留存记录。
            </div>
            <div className="flex gap-2.5 justify-end mt-1">
              <Btn onClick={() => setStep(1)}><ChevronLeft size={14} />返回修改</Btn>
              <Btn variant="primary" disabled={busy} onClick={submit}>{busy ? '提交中…' : '确认提交申报'}</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: 完成 */}
      {step === 3 && result && (
        <Card className="max-w-[640px] text-center !p-10">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.4)] flex items-center justify-center mb-4">
            <CheckCircle2 size={26} className="text-sgreen" />
          </div>
          <h2 className="text-[17px] font-bold mb-2">申报提交成功</h2>
          <p className="text-[12.5px] text-dim mb-1">平台已生成项目档案，编号 <span className="num text-accent">{result.code}</span></p>
          <p className="text-[12px] text-faint mb-6">
            审签流程已流转至「项目负责人」节点
            {srcFile ? '，申报书原件与 AI 识读结果已同步归档，可在项目详情「审批与归档」中下载' : '，各节点动态可在工作台跟踪'}
          </p>
          <div className="flex gap-2.5 justify-center">
            <Btn onClick={() => nav(`/projects/${result.projectId}`)}>查看项目档案</Btn>
            <Btn variant="primary" onClick={() => nav('/workbench')}>返回工作台</Btn>
          </div>
        </Card>
      )}

      <Modal open={dupOpen} onClose={() => setDupOpen(false)} title="项目查重结果（立项阶段入口）" width={720}>
        <div className="flex flex-col gap-4">
          <div className="text-[11.5px] text-faint">
            查重字段：项目名称、渠道、级别、责任单位、项目负责人、关键词。当前算法：{dupAlgorithm || '基础字段相似度'}；高级查重算法和历史库接口已预留。
          </div>
          {dupMatches.length === 0 ? (
            <div className="rounded-lg border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.07)] px-4 py-5 text-sgreen text-[13px]">
              暂未发现疑似重复项目，可继续提交；查重记录已写入审计日志。
            </div>
          ) : (
            <table className="dtable">
              <thead><tr><th>疑似项目</th><th>渠道/单位</th><th>相似度</th><th>命中字段</th><th>处理建议</th></tr></thead>
              <tbody>
                {dupMatches.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="font-medium max-w-[230px] truncate">{m.name}</div>
                      <div className="num text-[11px] text-accent">{m.code} · {m.status}</div>
                    </td>
                    <td className="text-[11.5px] text-dim">
                      {m.level} / {channelOf(m.channelId)?.name || '—'}
                      <div className="text-faint">{unitOf(m.unitId)?.short || '—'} · {m.owner}</div>
                    </td>
                    <td><span className={`num ${m.similarity >= 70 ? 'text-sred' : m.similarity >= 45 ? 'text-syellow' : 'text-accent'}`}>{m.similarity}%</span></td>
                    <td className="text-[11.5px] text-dim">{m.hitFields.join('、')}</td>
                    <td className="text-[11.5px] text-faint max-w-[220px]">{m.suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="rounded-lg border border-line bg-night2 px-3.5 py-2.5 text-[11.5px] text-faint">
            本轮实现“入口预留 + 基础字段查重 + 结果留痕”。如业务要求强阻断提交，可在后续将相似度阈值接入申报提交校验。
          </div>
          <div className="flex justify-end gap-2.5">
            <Btn onClick={() => setDupOpen(false)}>关闭</Btn>
            {dupMatches.length > 0 && <Btn variant="primary" onClick={() => setDupOpen(false)}>已核对，继续完善申报</Btn>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
