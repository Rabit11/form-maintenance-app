import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ChevronDown, Columns3, Download, FileSpreadsheet, Filter, RotateCcw, Save, Search, Trash2, UploadCloud, Users, XCircle } from 'lucide-react'
import { api, apiDownload, apiUpload } from '../../api/client'
import type { TransitionCascade, TransitionChangeLog, TransitionImportBatch, TransitionRow, TransitionToolData } from '../../api/types'
import { Btn, Card, Empty, Field, Input, KPI, Modal, Select, Tag, Textarea, useToast } from '../../components/ui'
import { wan } from '../../lib/format'
import { flattenCascadePaths, resolveCascade, resolveOrgOfficeFromCascade } from '../../lib/cascadePath'
import { pairResultItems, RESULT_FIELD_CODES, resultItemsPreview, serializeResultItems, type ResultItem } from '../../lib/resultItems'
import { useSession } from '../../store/session'

const LEVELS = ['国家级', '地方级', '公司级']
const OPERATOR_NO_KEY = 'form.operatorNo'
const HIDDEN_COLS_KEY = 'form.hiddenLedgerColumns'
const DEFAULT_RAIL_DESIGN = {
  autoLedger: ['总表统一汇聚', '按权限自动筛选', '变更记录全程留痕'],
  formMaintenance: ['总表批量预校验', '分表增量预校验', '确认后统一入库'],
}

function fundingRelation(row: Pick<TransitionRow, 'totalBudget' | 'centralGrant' | 'selfFund' | 'internalGrant' | 'internalSelfFund'>) {
  const amount = (value: unknown) => value == null || value === '' ? null : Number(value)
  const total = amount(row.totalBudget)
  const grant = amount(row.centralGrant) ?? 0
  const self = amount(row.selfFund) ?? 0
  const sum = grant + self
  const difference = total == null ? 0 : total - sum
  const issues: string[] = []
  if (total != null && Math.abs(difference) > 0.01) {
    const direction = difference > 0 ? '总经费比合计多' : '国拨与自筹合计比总经费多'
    issues.push(`总经费必须等于国拨经费与自筹经费之和；当前相差 ${Math.abs(difference).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 万元（${direction}）`)
  }
  const internalGrant = amount(row.internalGrant)
  const internalSelf = amount(row.internalSelfFund)
  if (internalGrant != null && internalGrant > grant + 0.01) issues.push('其中商飞内部单位国拨经费不能大于国拨经费')
  if (internalSelf != null && internalSelf > self + 0.01) issues.push('其中商飞内部单位自筹经费不能大于自筹经费')
  return { total, grant, self, sum, difference, issues, ok: issues.length === 0 }
}

function normalizeOperatorNo(value: string) {
  const text = value.trim().replace(/\s+/g, '')
  if (!text) return ''
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(text)) return ''
  return text
}

function monthKey(value: string | null | undefined) {
  const match = String(value || '').trim().match(/^(\d{4})[.\-/年](\d{1,2})(?:月)?$/)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return Number(match[1]) * 12 + month - 1
}
type UploadMode = 'replace' | 'merge'
type ImportUploadResponse = { batch: TransitionImportBatch }
type TransitionFieldMeta = TransitionToolData['fields'][number]
type MaintenanceTab = 'master' | 'split' | 'upload' | 'reports'

const TABS: { key: MaintenanceTab; label: string }[] = [
  { key: 'master', label: '总表管理' },
  { key: 'split', label: '分表拆分' },
  { key: 'upload', label: '批量上传' },
  { key: 'reports', label: '校验报告' },
]

function emptyCascade(): TransitionCascade {
  return {
    levels: LEVELS,
    sourcesByLevel: {},
    typesByLevel: {},
    typesByLevelSource: {},
    officesByLevelSource: {},
    typesByLevelSourceOffice: {},
    officeByType: {},
    pathByType: {},
    paths: [],
    major2ByMajor1: {},
  }
}

function filterMajor2Options(cascade: TransitionCascade, allMajor2: string[], major1: string) {
  if (!major1) return allMajor2
  const scoped = cascade.major2ByMajor1[major1]
  if (scoped?.length) return scoped
  const prefix = major1.match(/^(\d{2})/)?.[1]
  if (!prefix) return allMajor2
  return allMajor2.filter((x) => x.startsWith(prefix))
}

function excelColName(index: number) {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const mod = (n - 1) % 26
    name = String.fromCharCode(65 + mod) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function fieldMinWidth(field: TransitionFieldMeta) {
  return Math.max(86, Math.min(260, (field.width || 14) * 8))
}

function transitionCellValue(row: TransitionRow, field: TransitionFieldMeta) {
  if (RESULT_FIELD_CODES.has(field.code) && (field.code === 'resultNames' || field.code === 'convertedNames' || field.code === 'convertedMonth' || field.code === 'convertedModel')) {
    const items = row.resultItems?.length ? row.resultItems : pairResultItems(row)
    if (field.code === 'resultNames') return resultItemsPreview(items).text
    if (field.code === 'convertedNames') {
      const names = items.map((x) => x.convertedName).filter(Boolean)
      if (!names.length) return '—'
      return names.length <= 2 ? names.join('；') : `${names.slice(0, 2).join('；')} …+${names.length - 2}`
    }
    if (field.code === 'convertedMonth') {
      const months = items.map((x) => x.convertedMonth).filter(Boolean)
      if (!months.length) return '—'
      return months.length <= 2 ? months.join('；') : `${months.slice(0, 2).join('；')} …+${months.length - 2}`
    }
    if (field.code === 'convertedModel') {
      const models = items.map((x) => x.convertedModel).filter(Boolean)
      if (!models.length) return '—'
      return models.length <= 2 ? models.join('；') : `${models.slice(0, 2).join('；')} …+${models.length - 2}`
    }
  }
  const values: Record<string, unknown> = {
    serial: row.serial || row.code,
    sourceChannel: row.sourceChannel || row.channel,
    projectType: row.projectType || row.sourceSheet,
    demandUnit: row.demandUnit,
    responsibleUnit: row.responsibleUnit,
    totalBudget: row.totalBudget,
    centralGrant: row.centralGrant,
    internalGrant: row.internalGrant,
    selfFund: row.selfFund,
    internalSelfFund: row.internalSelfFund,
    spent: row.spent,
    budget2026: row.budget2026,
    budget2026Actual: row.budget2026Actual,
    closedActualBudget: row.closedActualBudget,
    closedGrantSpent: row.closedGrantSpent,
    closedSelfSpent: row.closedSelfSpent,
    resultCount: row.resultCount,
    convertedCount: row.convertedCount,
    reserveCount: row.reserveCount,
  }
  const value = Object.prototype.hasOwnProperty.call(values, field.code)
    ? values[field.code]
    : (row as unknown as Record<string, unknown>)[field.code]
  if (value == null || value === '') return '—'
  if (field.number && typeof value === 'number') return wan(value, 1)
  return String(value)
}

function resultItemsTitle(row: TransitionRow) {
  const items = row.resultItems?.length ? row.resultItems : pairResultItems(row)
  if (!items.length) return ''
  return items.map((item, i) => {
    const parts = [
      item.resultName && `成果${i + 1}:${item.resultName}`,
      item.convertedName && `转化:${item.convertedName}`,
      item.convertedMonth && `年月:${item.convertedMonth}`,
      item.convertedModel && `型号:${item.convertedModel}`,
    ].filter(Boolean)
    return parts.join(' / ')
  }).join('\n')
}

function passesColumnFilters(
  row: TransitionRow,
  fieldsByCode: Map<string, TransitionFieldMeta>,
  colFilters: Record<string, string[]>,
  skipCode?: string,
) {
  for (const [code, selected] of Object.entries(colFilters)) {
    if (skipCode && code === skipCode) continue
    if (!selected.length) continue
    const field = fieldsByCode.get(code)
    if (!field) continue
    if (!selected.includes(transitionCellValue(row, field))) return false
  }
  return true
}

function ColumnFilterButton({
  field,
  options,
  selected,
  onChange,
}: {
  field: TransitionFieldMeta
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [q, setQ] = useState('')
  const active = selected.length > 0 && selected.length < options.length
  const filteredOpts = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter((x) => x.toLowerCase().includes(needle))
  }, [options, q])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleOpen = (e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const width = 232
      const left = Math.min(rect.left, window.innerWidth - width - 8)
      setPos({ top: rect.bottom + 4, left: Math.max(8, left) })
      setQ('')
    }
    setOpen((v) => !v)
  }

  const allChecked = selected.length === 0 || selected.length === options.length
  const setAll = (checked: boolean) => onChange(checked ? [] : [...options])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={`筛选「${field.label}」`}
        className={`excel-filter-btn ${active || open ? 'is-active' : ''}`}
        onClick={toggleOpen}
      >
        <Filter size={11} />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="excel-filter-panel"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="excel-filter-hd">{field.label}</div>
          <input
            className="excel-filter-search"
            placeholder="搜索本列取值…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <label className="excel-filter-item excel-filter-all">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => setAll(e.target.checked)}
            />
            <span>（全部）</span>
          </label>
          <div className="excel-filter-list">
            {filteredOpts.map((opt) => {
              const checked = allChecked || selected.includes(opt)
              return (
                <label key={opt} className="excel-filter-item" title={opt}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const base = allChecked ? [...options] : [...selected]
                      const next = e.target.checked
                        ? [...new Set([...base, opt])]
                        : base.filter((x) => x !== opt)
                      onChange(next.length === options.length ? [] : next)
                    }}
                  />
                  <span>{opt}</span>
                </label>
              )
            })}
            {filteredOpts.length === 0 && <div className="excel-filter-empty">无匹配项</div>}
          </div>
          <div className="excel-filter-ft">
            <button type="button" onClick={() => { onChange([]); setOpen(false) }}>清除</button>
            <button type="button" className="primary" onClick={() => setOpen(false)}>确定</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export default function TransitionTool() {
  const toast = useToast()
  const { user } = useSession()
  const [data, setData] = useState<TransitionToolData | null>(null)
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('master')
  const [kw, setKw] = useState('')
  const [level, setLevel] = useState('')
  const [channel, setChannel] = useState('')
  const [office, setOffice] = useState('')
  const [unit, setUnit] = useState('')
  const [status, setStatus] = useState('')
  const [acceptanceStatus, setAcceptanceStatus] = useState('')
  const [color, setColor] = useState('')
  const [projectType, setProjectType] = useState('')
  const [startFrom, setStartFrom] = useState('')
  const [endTo, setEndTo] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [transformStatus, setTransformStatus] = useState('')
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(HIDDEN_COLS_KEY) || '[]')
      return Array.isArray(raw) ? raw.map(String) : []
    } catch {
      return []
    }
  })
  const [colCfgOpen, setColCfgOpen] = useState(false)
  const colCfgRef = useRef<HTMLDivElement | null>(null)
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({})
  const [edit, setEdit] = useState<TransitionRow | null>(null)
  const [editResultItems, setEditResultItems] = useState<ResultItem[]>([])
  const [busy, setBusy] = useState(false)
  const [previewBatches, setPreviewBatches] = useState<TransitionImportBatch[]>([])
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null)
  const [expandedImportRows, setExpandedImportRows] = useState<Set<number>>(new Set())
  const [reviewedBatchIds, setReviewedBatchIds] = useState<Set<number>>(new Set())
  const [forceImportIds, setForceImportIds] = useState<Set<number>>(new Set())
  const [importShowProblemsOnly, setImportShowProblemsOnly] = useState(true)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showAccessDetail, setShowAccessDetail] = useState(false)
  const [showUploadGuide, setShowUploadGuide] = useState(false)
  const [undoTarget, setUndoTarget] = useState<
    | { kind: 'log'; log: TransitionChangeLog }
    | { kind: 'batch'; batch: TransitionImportBatch }
    | null
  >(null)
  const [operatorNo, setOperatorNo] = useState(() => {
    const fromUser = normalizeOperatorNo(user?.emp_no || '')
    return fromUser || localStorage.getItem(OPERATOR_NO_KEY) || ''
  })
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const uploadModeRef = useRef<UploadMode>('merge')

  const [loadError, setLoadError] = useState('')
  const load = useCallback(() => {
    setLoadError('')
    api.get<TransitionToolData>('/transition-tool').then((d) => {
      setData(d)
      const autoNo = normalizeOperatorNo(d.access?.defaultOperatorNo || user?.emp_no || '')
      if (autoNo) setOperatorNo((prev) => normalizeOperatorNo(prev) || autoNo)
    }).catch((e) => {
      const msg = (e as Error).message || '加载失败'
      setLoadError(msg)
      setData(null)
      toast(msg, 'err')
      // 未改密却进入了主界面（如演示跳过改密）：退回强制改密
      if (/修改密码|须先修改密码/.test(msg)) {
        localStorage.removeItem('srpm.skipPwdGate')
        window.location.reload()
      }
    })
  }, [user?.emp_no, toast])
  useEffect(load, [load])

  useEffect(() => {
    const fromUser = normalizeOperatorNo(user?.emp_no || '')
    if (fromUser) setOperatorNo(fromUser)
  }, [user?.id, user?.emp_no])

  useEffect(() => {
    const normalized = normalizeOperatorNo(operatorNo)
    if (normalized) localStorage.setItem(OPERATOR_NO_KEY, normalized)
    else localStorage.removeItem(OPERATOR_NO_KEY)
  }, [operatorNo])

  useEffect(() => {
    localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify(hiddenCols))
  }, [hiddenCols])

  useEffect(() => {
    if (!colCfgOpen) return
    const onDoc = (e: MouseEvent) => {
      if (colCfgRef.current && !colCfgRef.current.contains(e.target as Node)) setColCfgOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [colCfgOpen])

  const requireOperatorNo = () => {
    const no = normalizeOperatorNo(operatorNo)
    if (!no) {
      toast('当前登录账号未绑定工号，请联系系统超级管理员维护账号信息', 'err')
      return ''
    }
    if (no !== operatorNo.trim()) setOperatorNo(no)
    return no
  }

  const toolbarRows = useMemo(() => {
    const cascadeMap = data?.cascade || emptyCascade()
    return (data?.rows || []).filter((r) => {
      if (projectType && (r.projectType || r.sourceSheet) !== projectType) return false
      if (level && r.level !== level) return false
      if (channel && (r.sourceChannel || r.channel) !== channel) return false
      if (office && resolveOrgOfficeFromCascade(cascadeMap, r) !== office) return false
      if (unit && ![r.responsibleUnit, r.demandUnit].some((x) => x === unit)) return false
      if (status && (r.projectStatus || r.acceptanceStatus) !== status) return false
      if (acceptanceStatus && r.acceptanceStatus !== acceptanceStatus) return false
      if (color && r.color !== color) return false
      if (startFrom) {
        const filterMonth = monthKey(startFrom)
        const rowMonth = monthKey(r.startMonth)
        if (filterMonth != null && (rowMonth == null || rowMonth < filterMonth)) return false
      }
      if (endTo) {
        const filterMonth = monthKey(endTo)
        const rowMonth = monthKey(r.endMonth)
        if (filterMonth != null && (rowMonth == null || rowMonth > filterMonth)) return false
      }
      const totalBudget = Number(r.totalBudget)
      if (budgetMin && (!Number.isFinite(totalBudget) || totalBudget < Number(budgetMin))) return false
      if (budgetMax && (!Number.isFinite(totalBudget) || totalBudget > Number(budgetMax))) return false
      if (transformStatus) {
        const converted = Number(r.convertedCount) || 0
        const result = Number(r.resultCount) || 0
        if (transformStatus === '已转化' && converted <= 0) return false
        if (transformStatus === '有成果未转化' && !(result > 0 && converted <= 0)) return false
        if (transformStatus === '暂无成果' && result > 0) return false
      }
      if (kw.trim()) {
        const needle = kw.trim().toLowerCase()
        const hay = [r.serial, r.code, r.name, r.projectType, r.sourceChannel, r.orgOffice, r.center, r.responsibleUnit, r.demandUnit].join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [data, projectType, level, channel, office, unit, status, acceptanceStatus, color, startFrom, endTo, budgetMin, budgetMax, transformStatus, kw])

  const fieldsByCode = useMemo(() => {
    const map = new Map<string, TransitionFieldMeta>()
    for (const f of data?.fields || []) map.set(f.code, f)
    return map
  }, [data])

  const rows = useMemo(
    () => toolbarRows.filter((r) => passesColumnFilters(r, fieldsByCode, colFilters)),
    [toolbarRows, fieldsByCode, colFilters],
  )

  const columnFilterOptions = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const field of data?.fields || []) {
      const base = toolbarRows.filter((r) => passesColumnFilters(r, fieldsByCode, colFilters, field.code))
      const set = new Set<string>()
      for (const r of base) set.add(transitionCellValue(r, field))
      map[field.code] = [...set].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
    }
    return map
  }, [data, toolbarRows, fieldsByCode, colFilters])

  const activeColFilterCount = useMemo(
    () => Object.values(colFilters).filter((v) => v.length > 0).length,
    [colFilters],
  )

  const setColumnFilter = (code: string, next: string[]) => {
    setColFilters((prev) => {
      const copy = { ...prev }
      if (!next.length) delete copy[code]
      else copy[code] = next
      return copy
    })
  }
  const filteredSummary = useMemo(() => {
    const summary = {
      total: rows.length,
      valid: 0,
      invalid: 0,
      budget: 0,
      centralGrant: 0,
      selfFund: 0,
      executing: 0,
      completed: 0,
      delayed: 0,
    }
    for (const row of rows) {
      if (row.validation.ok) summary.valid += 1; else summary.invalid += 1
      summary.budget += Number(row.totalBudget) || 0
      summary.centralGrant += Number(row.centralGrant) || 0
      summary.selfFund += Number(row.selfFund) || 0
      const projectStatus = String(row.projectStatus || '').trim()
      if (projectStatus === '进行中' || projectStatus === '验收中') summary.executing += 1
      if (projectStatus === '已完成') summary.completed += 1
      if (projectStatus === '延期') summary.delayed += 1
    }
    return summary
  }, [rows])
  const exportQuery = useMemo(() => {
    const q = new URLSearchParams()
    if (kw.trim()) q.set('kw', kw.trim())
    if (projectType) q.set('projectType', projectType)
    if (level) q.set('level', level)
    if (channel) q.set('channel', channel)
    if (office) q.set('office', office)
    if (unit) q.set('unit', unit)
    if (status) q.set('status', status)
    if (acceptanceStatus) q.set('acceptanceStatus', acceptanceStatus)
    if (color) q.set('color', color)
    if (startFrom) q.set('startFrom', startFrom)
    if (endTo) q.set('endTo', endTo)
    if (budgetMin) q.set('budgetMin', budgetMin)
    if (budgetMax) q.set('budgetMax', budgetMax)
    if (transformStatus) q.set('transformStatus', transformStatus)
    if (Object.keys(colFilters).length) q.set('columnFilters', JSON.stringify(colFilters))
    const s = q.toString()
    return s ? `?${s}` : ''
  }, [kw, projectType, level, channel, office, unit, status, acceptanceStatus, color, startFrom, endTo, budgetMin, budgetMax, transformStatus, colFilters])

  const exportLabel = useMemo(() => {
    if (projectType) return projectType
    const parts = [level, channel, office].filter(Boolean)
    if (parts.length) return parts.join(' / ')
    const types = [...new Set(rows.map((r) => r.projectType || r.sourceSheet).filter(Boolean))]
    if (types.length === 1) return types[0]
    if (types.length > 1) return `当前筛选（${types.length}类）`
    return '当前筛选'
  }, [projectType, level, channel, office, rows])

  const exportExcelName = useMemo(() => {
    if (projectType) return `预研项目_专项分表_${projectType}.xlsx`
    return `预研项目_${exportLabel === '当前筛选' ? '总表_全量' : `筛选总表_${exportLabel}`}.xlsx`
  }, [projectType, exportLabel])

  const exportZipName = useMemo(() => {
    if (projectType) return `预研项目_专项分表包_${projectType}.zip`
    return `预研项目_总表及分表包_${exportLabel}.zip`
  }, [projectType, exportLabel])

  const access = data?.access
  const visibleFieldGroups = access?.visibleFieldGroups || null
  const excelFields = useMemo(
    () => [...(data?.fields || [])]
      .filter((field) => field.ledger !== false)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0)),
    [data],
  )
  const allGroupNames = useMemo(() => {
    const groups = [...new Set(excelFields.map((field) => field.group))]
    if (visibleFieldGroups?.length) return groups.filter((g) => visibleFieldGroups.includes(g))
    return groups
  }, [excelFields, visibleFieldGroups])
  const configurableFields = useMemo(() => {
    if (visibleFieldGroups?.length) return excelFields.filter((field) => visibleFieldGroups.includes(field.group))
    return excelFields
  }, [excelFields, visibleFieldGroups])
  const tableFields = useMemo(() => {
    const hidden = new Set(hiddenCols)
    return configurableFields.filter((field) => !hidden.has(field.code))
  }, [configurableFields, hiddenCols])
  const hiddenColCount = useMemo(
    () => configurableFields.filter((f) => hiddenCols.includes(f.code)).length,
    [configurableFields, hiddenCols],
  )
  const excelHeader = useMemo(() => {
    type Cell = { key: string; label: string; colSpan?: number; rowSpan?: number; field?: TransitionFieldMeta; colIndex?: number; className?: string }
    const top: Cell[] = []
    const mid: Cell[] = []
    const leaf: Cell[] = []
    let i = 0
    while (i < tableFields.length) {
      const field = tableFields[i]
      if (field.headerBanner) {
        top.push({ key: `banner-${field.code}`, label: field.label, rowSpan: 3, field, colIndex: i, className: 'excel-banner' })
        i += 1
        continue
      }
      let j = i + 1
      while (j < tableFields.length && tableFields[j].group === field.group && !tableFields[j].headerBanner) j += 1
      top.push({ key: `group-${field.group}-${i}`, label: field.group, colSpan: j - i, className: 'excel-group' })
      i = j
    }
    i = 0
    while (i < tableFields.length) {
      const field = tableFields[i]
      if (field.headerBanner) {
        i += 1
        continue
      }
      if (!field.subGroup) {
        mid.push({ key: `leafspan-${field.code}`, label: field.label, rowSpan: 2, field, colIndex: i })
        i += 1
        continue
      }
      let j = i + 1
      while (j < tableFields.length && tableFields[j].subGroup === field.subGroup && !tableFields[j].headerBanner) j += 1
      mid.push({ key: `sub-${field.subGroup}-${i}`, label: field.subGroup, colSpan: j - i, className: 'excel-subgroup' })
      for (let k = i; k < j; k += 1) {
        const leafField = tableFields[k]
        leaf.push({ key: `leaf-${leafField.code}`, label: leafField.label, field: leafField, colIndex: k })
      }
      i = j
    }
    return { top, mid, leaf }
  }, [tableFields])
  const pendingBatches = useMemo(
    () => (data?.batches || []).filter((b) => ['待确认', '待修正'].includes(b.status)),
    [data],
  )
  const advancedFilterCount = useMemo(() => (
    [office, acceptanceStatus, transformStatus, color, startFrom, endTo, budgetMin, budgetMax]
      .filter((x) => String(x || '').trim()).length
  ), [office, acceptanceStatus, transformStatus, color, startFrom, endTo, budgetMin, budgetMax])
  const accessTone = access?.mode === 'hq' ? 'accent' : access?.mode === 'channel' ? 'yellow' : (access?.mode === 'owner' || access?.mode === 'unit') ? 'green' : 'dim' as const
  const currentTypeCount = useMemo(() => {
    const set = new Set(rows.map((r) => r.projectType || r.sourceSheet).filter(Boolean))
    return set.size
  }, [rows])
  const activeBatch = useMemo(
    () => previewBatches.find((x) => x.id === activeBatchId) || null,
    [previewBatches, activeBatchId],
  )
  const activeBatchProblemRows = useMemo(() => {
    if (!activeBatch?.rows?.length) return []
    return activeBatch.rows.filter((x) => x.action === 'skip' || !x.validation?.ok || Boolean(x.issue))
  }, [activeBatch])
  const activeBatchProblemGroups = useMemo(() => {
    const map = new Map<string, { issue: string; count: number; samples: { rowNo: string | number; name: string }[] }>()
    for (const row of activeBatchProblemRows) {
      const issue = row.issue || row.validation?.missing?.concat(row.validation?.warnings || []).join('；') || '校验未通过'
      const key = issue.slice(0, 180)
      const cur = map.get(key) || { issue, count: 0, samples: [] }
      cur.count += 1
      if (cur.samples.length < 5) {
        cur.samples.push({
          rowNo: row.rowNo || '—',
          name: row.projectName || row.row?.name || '—',
        })
      }
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [activeBatchProblemRows])
  const activeBatchVisibleRows = useMemo(() => {
    const rows = activeBatch?.rows || []
    if (!importShowProblemsOnly || !activeBatch?.invalid_count) return rows
    return rows.filter((x) => x.action === 'skip' || !x.validation?.ok || Boolean(x.issue))
  }, [activeBatch, importShowProblemsOnly])
  const editFunding = edit ? fundingRelation(edit) : null
  const cascade = useMemo(() => {
    const base = data?.cascade || emptyCascade()
    const importedPaths = (data?.rows || []).flatMap((row) => {
      const level = (row.level || '').trim()
      const sourceChannel = (row.sourceChannel || row.channel || '').trim()
      const orgOffice = (row.orgOffice || '').trim()
      const projectType = (row.projectType || row.sourceSheet || '').trim()
      return level && sourceChannel && projectType
        ? [{ level, sourceChannel, orgOffice, projectType }]
        : []
    })
    const paths = [...flattenCascadePaths(base), ...importedPaths]
      .filter((path, index, all) => all.findIndex((item) =>
        item.level === path.level
        && item.sourceChannel === path.sourceChannel
        && item.orgOffice === path.orgOffice
        && item.projectType === path.projectType) === index)
    return {
      ...base,
      levels: [...new Set([...(base.levels || []), ...(data?.filterOptions.levels || [])])],
      paths,
    }
  }, [data])
  const projectTypeOptionsAll = useMemo(
    () => [...(data?.dictionaries.projectTypes || []), ...(data?.filterOptions.projectTypes || [])]
      .filter((x, i, a) => x && a.indexOf(x) === i),
    [data],
  )
  const sourceChannelOptionsAll = useMemo(
    () => [...(data?.dictionaries.sourceChannels || []), ...(data?.filterOptions.channels || [])]
      .filter((x, i, a) => x && a.indexOf(x) === i),
    [data],
  )
  const filterCascade = useMemo(
    () => resolveCascade(
      cascade,
      { level, sourceChannel: channel, orgOffice: office, projectType },
      {
        mode: 'filter',
        reverseBackfill: true,
        allSources: sourceChannelOptionsAll,
        allTypes: projectTypeOptionsAll,
      },
    ),
    [cascade, level, channel, office, projectType, sourceChannelOptionsAll, projectTypeOptionsAll],
  )
  const sourceChannelOptions = filterCascade.options.sources
  const officeOptions = filterCascade.options.offices
  const projectTypeOptions = filterCascade.options.types.length
    ? filterCascade.options.types
    : projectTypeOptionsAll

  const editCascade = useMemo(
    () => resolveCascade(
      cascade,
      {
        level: edit?.level || '',
        sourceChannel: edit?.sourceChannel || edit?.channel || '',
        orgOffice: edit?.orgOffice || '',
        projectType: edit?.projectType || edit?.sourceSheet || '',
      },
      {
        mode: 'edit',
        reverseBackfill: true,
        allSources: sourceChannelOptionsAll,
        allTypes: projectTypeOptionsAll,
      },
    ),
    [cascade, edit, sourceChannelOptionsAll, projectTypeOptionsAll],
  )
  const editSourceOptions = editCascade.options.sources
  const editOfficeOptions = editCascade.options.offices
  const editProjectTypeOptions = editCascade.options.types.length
    ? editCascade.options.types
    : projectTypeOptionsAll
  const editMajor2Options = useMemo(
    () => filterMajor2Options(cascade, data?.dictionaries.major2 || [], edit?.major1 || ''),
    [cascade, data?.dictionaries.major2, edit?.major1],
  )
  const ownerByType = useMemo(
    () => new Map((data?.typeOwners || []).map((owner) => [owner.projectType, owner])),
    [data],
  )
  const canWrite = Boolean(access?.canWrite)
  const canImportMaster = Boolean(access?.canImportMaster)
  const canExport = Boolean(access?.canExport)
  const canExportAll = Boolean(access?.canExportAll)
  const isOwnerMode = access?.mode === 'owner'
  const isChannelMode = access?.mode === 'channel'
  const isUnitMode = access?.mode === 'unit'
  const ownedTypes = access?.ownedTypes || []
  const ownedLevels = access?.ownedLevels || []
  const channelScopeInitializedRef = useRef(false)

  const rowWritable = (row: TransitionRow) => {
    if (!canWrite) return false
    if (typeof row.canWriteRow === 'boolean') return row.canWriteRow
    if (access?.mode === 'hq') return true
    if (access?.mode === 'owner') return ownedTypes.includes(row.projectType || row.sourceSheet || '')
    if (access?.mode === 'channel') return ownedLevels.includes(row.level)
    if (access?.mode === 'unit') {
      const names = access.ownedUnitNames || []
      const text = `${row.responsibleUnit || ''} ${row.demandUnit || ''} ${row.center || ''}`
      return names.some((n) => text.includes(n))
    }
    return false
  }

  useEffect(() => {
    if (!isOwnerMode || !ownedTypes.length) return
    if (!projectType || !ownedTypes.includes(projectType)) {
      setProjectType(ownedTypes.length === 1 ? ownedTypes[0] : '')
    }
  }, [isOwnerMode, ownedTypes, projectType])

  useEffect(() => {
    if (!isChannelMode || !ownedLevels.length) {
      channelScopeInitializedRef.current = false
      return
    }
    if (!channelScopeInitializedRef.current) {
      setLevel(ownedLevels.length === 1 ? ownedLevels[0] : '')
      setChannel('')
      setOffice('')
      setProjectType('')
      channelScopeInitializedRef.current = true
    }
  }, [isChannelMode, ownedLevels])

  const applyFilterCascade = (
    partial: {
      level?: string
      sourceChannel?: string
      orgOffice?: string
      projectType?: string
    },
    driver: 'level' | 'sourceChannel' | 'orgOffice' | 'projectType',
  ) => {
    const r = resolveCascade(cascade, partial, {
      mode: 'filter',
      driver,
      reverseBackfill: true,
      allSources: sourceChannelOptionsAll,
      allTypes: projectTypeOptionsAll,
    })
    setLevel(r.next.level)
    setChannel(r.next.sourceChannel)
    setOffice(r.next.orgOffice)
    setProjectType(r.next.projectType)
  }

  const onFilterLevelChange = (next: string) => {
    applyFilterCascade({ level: next, sourceChannel: channel, orgOffice: office, projectType }, 'level')
  }
  const onFilterChannelChange = (next: string) => {
    applyFilterCascade({ level, sourceChannel: next, orgOffice: office, projectType }, 'sourceChannel')
  }
  const onFilterOfficeChange = (next: string) => {
    applyFilterCascade({ level, sourceChannel: channel, orgOffice: next, projectType }, 'orgOffice')
  }
  const onFilterTypeChange = (next: string) => {
    applyFilterCascade({ level, sourceChannel: channel, orgOffice: office, projectType: next }, 'projectType')
  }

  const applyEditCascade = (
    base: TransitionRow,
    partial: {
      level?: string
      sourceChannel?: string
      orgOffice?: string
      projectType?: string
    },
    driver: 'level' | 'sourceChannel' | 'orgOffice' | 'projectType',
  ) => {
    const r = resolveCascade(cascade, {
      level: partial.level ?? base.level,
      sourceChannel: partial.sourceChannel ?? base.sourceChannel ?? base.channel,
      orgOffice: partial.orgOffice ?? base.orgOffice,
      projectType: partial.projectType ?? base.projectType ?? base.sourceSheet,
    }, {
      mode: 'edit',
      driver,
      reverseBackfill: true,
      allSources: sourceChannelOptionsAll,
      allTypes: projectTypeOptionsAll,
    })
    setEdit({
      ...base,
      level: r.next.level,
      sourceChannel: r.next.sourceChannel,
      channel: r.next.sourceChannel,
      orgOffice: r.next.orgOffice,
      projectType: r.next.projectType,
      sourceType: r.next.projectType,
      sourceSheet: r.next.projectType,
    })
  }

  const pickFiles = (mode: UploadMode) => {
    if (!requireOperatorNo()) return
    uploadModeRef.current = mode
    uploadRef.current?.click()
  }

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const no = requireOperatorNo()
    if (!no) {
      if (uploadRef.current) uploadRef.current.value = ''
      return
    }
    setActiveTab('upload')
    const mode = uploadModeRef.current
    setBusy(true)
    const batches: TransitionImportBatch[] = []
    const failures: string[] = []
    try {
      for (let i = 0; i < files.length; i += 1) {
        try {
          const upload = await apiUpload(files[i])
          const importMode: UploadMode = mode === 'replace' && i > 0 ? 'merge' : mode
          const result = await api.post<ImportUploadResponse>('/transition-tool/import-upload', {
            uploadId: upload.id,
            mode: importMode,
            operatorNo: no,
          })
          batches.push(result.batch)
          setPreviewBatches((old) => [result.batch, ...old.filter((x) => x.id !== result.batch.id)])
          setExpandedImportRows(new Set())
          setImportShowProblemsOnly(true)
          setActiveBatchId(result.batch.id)
        } catch (error) {
          failures.push(`${files[i].name}：${(error as Error).message}`)
        }
      }
      const added = batches.reduce((s, x) => s + x.added_count, 0)
      const updated = batches.reduce((s, x) => s + x.updated_count, 0)
      const invalid = batches.reduce((s, x) => s + x.invalid_count, 0)
      if (batches.length) toast(`预校验完成：成功 ${batches.length} 个文件，待新增 ${added} 行，待更新 ${updated} 行，问题 ${invalid} 行`)
      if (failures.length) toast(`有 ${failures.length} 个文件失败：${failures[0]}`, 'err')
    } finally {
      if (uploadRef.current) uploadRef.current.value = ''
      load()
      setBusy(false)
    }
  }

  const openBatch = async (id: number) => {
    setBusy(true)
    try {
      const r = await api.get<{ batch: TransitionImportBatch }>(`/transition-tool/import-batches/${id}`)
      setPreviewBatches((old) => {
        const rest = old.filter((x) => x.id !== r.batch.id)
        return [r.batch, ...rest]
      })
      setExpandedImportRows(new Set())
      setImportShowProblemsOnly(true)
      setActiveBatchId(r.batch.id)
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const confirmBatch = async (id: number) => {
    const batch = previewBatches.find((x) => x.id === id)
    const no = requireOperatorNo()
    if (!no) return
    if (batch && batch.invalid_count > 0 && !forceImportIds.has(id)) {
      toast('该批次存在问题行。若仍要入库，请先勾选「已知晓问题仍确认入库」', 'err')
      return
    }
    setBusy(true)
    try {
      const r = await api.post<{ batch: TransitionImportBatch }>(`/transition-tool/import-batches/${id}/confirm`, {
        operatorNo: no,
        forceDespiteIssues: Boolean(batch && batch.invalid_count > 0 && forceImportIds.has(id)),
      })
      toast(`已确认入库：新增 ${r.batch.added_count} 行，更新 ${r.batch.updated_count} 行（工号 ${no}）`)
      setPreviewBatches((old) => old.filter((x) => x.id !== id))
      setActiveBatchId(null)
      setForceImportIds((old) => {
        const next = new Set(old)
        next.delete(id)
        return next
      })
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const cancelBatch = async (id: number) => {
    setBusy(true)
    try {
      await api.post(`/transition-tool/import-batches/${id}/cancel`)
      toast('已取消该导入批次，未写入总表')
      setPreviewBatches((old) => old.filter((x) => x.id !== id))
      setActiveBatchId(null)
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const submitUndo = async () => {
    if (!undoTarget) return
    const no = requireOperatorNo()
    if (!no) return
    setBusy(true)
    try {
      if (undoTarget.kind === 'log') {
        await api.post(`/transition-tool/change-logs/${undoTarget.log.id}/undo`, { operatorNo: no })
        toast(`已撤回变更：${undoTarget.log.projectName || undoTarget.log.identityKey}`)
      } else {
        await api.post(`/transition-tool/import-batches/${undoTarget.batch.id}/undo`, { operatorNo: no })
        toast(`已撤回入库批次：${undoTarget.batch.file_name}`)
        setPreviewBatches((old) => old.filter((x) => x.id !== undoTarget.batch.id))
        if (activeBatchId === undoTarget.batch.id) setActiveBatchId(null)
      }
      setUndoTarget(null)
      load()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!edit) return
    const packed = serializeResultItems(editResultItems)
    const nextEdit = { ...edit, ...packed }
    const funding = fundingRelation(nextEdit)
    if (!funding.ok) {
      toast(funding.issues[0], 'err')
      return
    }
    const no = requireOperatorNo()
    if (!no) return
    setBusy(true)
    try {
      await api.post('/transition-tool/records', { ...nextEdit, operatorNo: no })
      toast(`分表记录已保存并留痕（工号 ${no}）`)
      setEdit(null)
      setEditResultItems([])
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const removeProject = async () => {
    if (!edit?.id) return
    const name = edit.name || edit.serial || edit.id
    if (!window.confirm(`确认删除项目「${name}」的全部台账信息？\n\n删除后可在「校验报告」中撤回；删除前会自动备份。`)) return
    const no = requireOperatorNo()
    if (!no) return
    setBusy(true)
    try {
      await api.post('/transition-tool/records/delete', { id: edit.id, operatorNo: no })
      toast(`已删除项目「${name}」（工号 ${no}）`)
      setEdit(null)
      setEditResultItems([])
      load()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  const toggleColumn = (code: string) => {
    setHiddenCols((old) => (old.includes(code) ? old.filter((x) => x !== code) : [...old, code]))
  }

  const setGroupColumnsVisible = (group: string, visible: boolean) => {
    const codes = configurableFields.filter((f) => f.group === group).map((f) => f.code)
    setHiddenCols((old) => {
      const set = new Set(old)
      for (const code of codes) {
        if (visible) set.delete(code)
        else set.add(code)
      }
      return [...set]
    })
  }

  const download = async (path: string, name: string) => {
    if (!rows.length) {
      toast('当前筛选无数据，请先选择项目类型或调整筛选条件', 'err')
      return
    }
    setBusy(true)
    try {
      const actualName = await apiDownload(path, name)
      toast(`已下载：${actualName}`)
    }
    catch (e) { toast((e as Error).message, 'err') }
    finally { setBusy(false) }
  }

  if (!data) {
    return (
      <div className="text-faint text-sm py-20 text-center flex flex-col items-center gap-3">
        <div>{loadError ? '表单维护加载失败' : '正在加载表单维护…'}</div>
        {loadError && (
          <>
            <div className="text-syellow text-[12.5px] max-w-[520px] leading-relaxed">{loadError}</div>
            <Btn onClick={load}>重试</Btn>
          </>
        )}
      </div>
    )
  }

  const typeSelectOptions = isOwnerMode && ownedTypes.length
    ? ownedTypes
    : projectTypeOptions

  return (
    <div className="flex flex-col gap-3 fade-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold tracking-wide">表单维护</div>
          <div className="text-[11.5px] text-faint mt-0.5 max-w-[640px] truncate">
            {access?.maintObject
              ? `维护对象：${access.maintObject}`
              : isOwnerMode
                ? `项目类型主管 · ${ownedTypes.join('、') || '尚未授权类型'}`
                : '总部维护总表 · 主管维护分表 · 其余角色只读'}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Tag tone={accessTone}>{access?.label || '未识别权限'}</Tag>
          {!canWrite && <Tag tone="yellow">只读</Tag>}
          <button type="button" className="chip text-[11px] inline-flex items-center gap-1" onClick={() => setShowAccessDetail((v) => !v)}>
            权限说明
            <ChevronDown size={12} className={`transition-transform ${showAccessDetail ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {showAccessDetail && (
        <div className="rounded-lg border border-line2 bg-[rgba(17,26,46,0.55)] px-3.5 py-2.5 text-[11.5px] text-dim flex flex-wrap gap-x-4 gap-y-1.5">
          <span>查看：{access?.rights?.read || '—'}</span>
          <span>修改：{access?.rights?.write || '—'}</span>
          <span>导出：{access?.rights?.export || '—'}</span>
          {access?.roleLabel && <span>角色：{access.roleLabel}</span>}
          {isChannelMode && ownedLevels.length > 0 && <span>层级：{ownedLevels.join('、')}</span>}
          {canExport ? <span className="text-accent">可导出</span> : <span>禁导出</span>}
        </div>
      )}

      <input ref={uploadRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => importFiles(e.target.files)} />

      <Card pad className="!p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-faint shrink-0">操作</span>
          <div className="h-4 w-px bg-[rgba(148,163,184,0.2)] shrink-0" />
          {canImportMaster && <Btn disabled={busy} onClick={() => pickFiles('replace')}><UploadCloud size={14} />上传总表</Btn>}
          {canWrite && <Btn disabled={busy} onClick={() => pickFiles('merge')}><UploadCloud size={14} />上传分表</Btn>}
          {canExport ? (
            <Btn variant="primary" disabled={busy} title={`按当前筛选导出：${exportLabel}`} onClick={() => download(`/transition-tool/export.xlsx${exportQuery}`, exportExcelName)}>
              <Download size={14} />导出 Excel
            </Btn>
          ) : (
            <Tag tone="dim">无导出权限</Tag>
          )}
          {canExportAll && (
            <Btn disabled={busy} title={projectType ? `仅打包「${projectType}」专项分表` : `打包当前筛选下各专项分表：${exportLabel}`} onClick={() => download(`/transition-tool/export-package.zip${exportQuery}`, exportZipName)}>
              <Download size={14} />{projectType ? '导出分表包' : '导出筛选包'}
            </Btn>
          )}
        </div>
      </Card>

      <Card pad className="!p-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] text-faint shrink-0">筛选</span>
          <div className="h-4 w-px bg-[rgba(148,163,184,0.2)] shrink-0" />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input aria-label="搜索" placeholder="序号 / 项目名称 / 编号" value={kw} onChange={(e) => setKw(e.target.value)} style={{ width: 210, paddingLeft: 32 }} />
          </div>
          <Select aria-label="层级" value={level} onChange={(e) => onFilterLevelChange(e.target.value)} style={{ width: 108 }}>
            <option value="">全部层级</option>
            {(data.filterOptions.levels || cascade.levels || LEVELS).map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="项目来源/渠道" value={channel} onChange={(e) => onFilterChannelChange(e.target.value)} style={{ width: 140 }}>
            <option value="">全部渠道</option>
            {sourceChannelOptions.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="项目类型" value={projectType} onChange={(e) => onFilterTypeChange(e.target.value)} style={{ width: 190 }}>
            <option value="">{isOwnerMode ? '我负责的全部类型' : '全部项目类型'}</option>
            {typeSelectOptions.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="单位" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 140 }}>
            <option value="">全部单位</option>
            {data.filterOptions.units.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 112 }}>
            <option value="">全部状态</option>
            {data.filterOptions.statuses.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <button
            type="button"
            className={`chip inline-flex items-center gap-1 ${showAdvancedFilters || advancedFilterCount ? 'text-accent border-[rgba(56,189,248,0.35)]' : ''}`}
            onClick={() => setShowAdvancedFilters((v) => !v)}
          >
            高级筛选{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
            <ChevronDown size={12} className={`transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {showAdvancedFilters && (
          <div className="flex items-center gap-2.5 flex-wrap mt-2.5 pt-2.5 border-t border-line">
            <Select aria-label="司局/处室" value={office} onChange={(e) => onFilterOfficeChange(e.target.value)} style={{ width: 140 }} title="筛选辅助，不写入 Excel">
              <option value="">全部司局/处室</option>
              {officeOptions.map((x) => <option key={x}>{x}</option>)}
            </Select>
            <Select aria-label="验收状态" value={acceptanceStatus} onChange={(e) => setAcceptanceStatus(e.target.value)} style={{ width: 130 }}>
              <option value="">全部验收</option>
              {data.filterOptions.acceptanceStatuses.map((x) => <option key={x}>{x}</option>)}
            </Select>
            <Select aria-label="成果转化状态" value={transformStatus} onChange={(e) => setTransformStatus(e.target.value)} style={{ width: 140 }}>
              <option value="">全部成果</option>
              {data.filterOptions.transformStatuses.map((x) => <option key={x}>{x}</option>)}
            </Select>
            <Select aria-label="预警" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 110 }}>
              <option value="">全部预警</option>
              <option value="red">红</option><option value="yellow">黄</option><option value="blue">蓝</option><option value="green">绿</option>
            </Select>
            <Input aria-label="开始年月不早于" placeholder="开始≥YYYY.M" value={startFrom} onChange={(e) => setStartFrom(e.target.value)} style={{ width: 118 }} />
            <Input aria-label="结束年月不晚于" placeholder="结束≤YYYY.M" value={endTo} onChange={(e) => setEndTo(e.target.value)} style={{ width: 118 }} />
            <Input aria-label="经费下限" placeholder="经费≥万" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} style={{ width: 98 }} />
            <Input aria-label="经费上限" placeholder="经费≤万" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} style={{ width: 98 }} />
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg border text-[12px] cursor-pointer ${
              activeTab === tab.key ? 'border-accent text-accent bg-[rgba(56,189,248,0.09)]' : 'border-line2 text-dim hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.key === 'upload' && pendingBatches.length > 0 && (
              <span className="ml-1.5 num text-[10px] text-syellow">{pendingBatches.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'master' && <Card
        title={<span className="flex items-center gap-2"><FileSpreadsheet size={15} />预先研究项目信息</span>}
        extra={(
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {activeColFilterCount > 0 && (
              <button type="button" className="chip text-accent border-[rgba(56,189,248,0.35)]" onClick={() => setColFilters({})} title="清除所有列表头筛选">
                清除列筛选 ({activeColFilterCount})
              </button>
            )}
            <div className="relative" ref={colCfgRef}>
              <button
                type="button"
                className={`chip inline-flex items-center gap-1.5 ${colCfgOpen || hiddenColCount > 0 ? 'text-accent border-[rgba(56,189,248,0.35)]' : ''}`}
                onClick={() => setColCfgOpen((v) => !v)}
                title="配置表格显示列"
              >
                <Columns3 size={13} />
                列配置
                {hiddenColCount > 0
                  ? <span className="num text-[10px]">已收起 {hiddenColCount}</span>
                  : <span className="num text-[10px] text-faint">{tableFields.length} 列</span>}
                <ChevronDown size={12} className={`transition-transform ${colCfgOpen ? 'rotate-180' : ''}`} />
              </button>
              {colCfgOpen && (
                <div className="absolute right-0 top-9 z-30 w-[360px] max-h-[420px] overflow-y-auto rounded-lg border border-line2 bg-[#0f1a2e] shadow-2xl p-3">
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <span className="text-[12px] font-medium grow">显示列</span>
                    <button type="button" className="chip text-[11px]" onClick={() => setHiddenCols([])}>全部显示</button>
                    <button
                      type="button"
                      className="chip text-[11px]"
                      onClick={() => setHiddenCols(configurableFields.map((f) => f.code))}
                    >
                      全部收起
                    </button>
                  </div>
                  <div className="text-[11px] text-faint mb-2">勾选显示，取消勾选即收起；仅影响本页表格，导出仍按完整表头。</div>
                  {allGroupNames.map((group) => {
                    const groupFields = configurableFields.filter((f) => f.group === group)
                    const shown = groupFields.filter((f) => !hiddenCols.includes(f.code)).length
                    return (
                      <div key={group} className="mb-3 last:mb-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="text-[11.5px] font-semibold text-dim grow">{group}</div>
                          <button type="button" className="text-[10.5px] text-accent cursor-pointer" onClick={() => setGroupColumnsVisible(group, true)}>全显</button>
                          <button type="button" className="text-[10.5px] text-faint cursor-pointer" onClick={() => setGroupColumnsVisible(group, false)}>收起</button>
                          <span className="text-[10px] text-faint num">{shown}/{groupFields.length}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {groupFields.map((field) => {
                            const checked = !hiddenCols.includes(field.code)
                            return (
                              <label key={field.code} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[rgba(56,189,248,0.06)] cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="accent-cyan-400"
                                  checked={checked}
                                  onChange={() => toggleColumn(field.code)}
                                />
                                <span className={`text-[12px] ${checked ? 'text-ink' : 'text-faint'}`}>{field.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        pad={false}
        className="overflow-hidden"
      >
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap px-4 py-2.5 border-b border-line text-[12px]">
          <span className="num text-ink"><span className="text-faint mr-1">项目</span>{filteredSummary.total}</span>
          <span className="num text-ink"><span className="text-faint mr-1">类型</span>{currentTypeCount}</span>
          <span className="num text-accent"><span className="text-faint mr-1">总经费</span>{wan(filteredSummary.budget, 1)} 万</span>
          <span className="num text-dim"><span className="text-faint mr-1">国拨</span>{wan(filteredSummary.centralGrant, 1)}</span>
          <span className="num text-dim"><span className="text-faint mr-1">自筹</span>{wan(filteredSummary.selfFund, 1)}</span>
          <span className="text-dim">执行中 {filteredSummary.executing}</span>
          <span className="text-sgreen">已完成 {filteredSummary.completed}</span>
          {filteredSummary.delayed > 0 && <span className="text-sred">延期 {filteredSummary.delayed}</span>}
          <span className={filteredSummary.invalid ? 'text-syellow' : 'text-sgreen'}>
            {filteredSummary.invalid ? `待修正 ${filteredSummary.invalid}` : '校验通过'}
          </span>
          {data.summary.duplicates.length > 0 && <span className="text-syellow">重复 {data.summary.duplicates.length}</span>}
          <span className="text-[11px] text-faint ml-auto hidden lg:inline">表头漏斗可按列筛选 · 导出完整表头</span>
        </div>
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] min-h-[360px]">
          <table className="excel-ledger-table excel-ledger-table--tier3">
            <thead>
              <tr>
                {excelHeader.top.map((cell) => (
                  <th
                    key={cell.key}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className={cell.className}
                  >
                    {cell.field ? (
                      <div className="excel-th-main">
                        <div className="min-w-0">
                          <span className="excel-col">{excelColName(cell.colIndex ?? 0)}</span>
                          <span className="excel-th-label">{cell.label}</span>
                        </div>
                        <ColumnFilterButton
                          field={cell.field}
                          options={columnFilterOptions[cell.field.code] || []}
                          selected={colFilters[cell.field.code] || []}
                          onChange={(next) => setColumnFilter(cell.field!.code, next)}
                        />
                      </div>
                    ) : (
                      cell.label
                    )}
                  </th>
                ))}
              </tr>
              <tr>
                {excelHeader.mid.map((cell) => (
                  <th
                    key={cell.key}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className={cell.className}
                    style={cell.field ? { minWidth: fieldMinWidth(cell.field) } : undefined}
                  >
                    {cell.field ? (
                      <div className="excel-th-main">
                        <div className="min-w-0">
                          <span className="excel-col">{excelColName(cell.colIndex ?? 0)}</span>
                          <span className="excel-th-label">{cell.label}</span>
                        </div>
                        <ColumnFilterButton
                          field={cell.field}
                          options={columnFilterOptions[cell.field.code] || []}
                          selected={colFilters[cell.field.code] || []}
                          onChange={(next) => setColumnFilter(cell.field!.code, next)}
                        />
                      </div>
                    ) : (
                      cell.label
                    )}
                  </th>
                ))}
              </tr>
              <tr>
                {excelHeader.leaf.map((cell) => (
                  <th key={cell.key} style={cell.field ? { minWidth: fieldMinWidth(cell.field) } : undefined}>
                    {cell.field && (
                      <div className="excel-th-main">
                        <div className="min-w-0">
                          <span className="excel-col">{excelColName(cell.colIndex ?? 0)}</span>
                          <span className="excel-th-label">{cell.label}</span>
                        </div>
                        <ColumnFilterButton
                          field={cell.field}
                          options={columnFilterOptions[cell.field.code] || []}
                          selected={colFilters[cell.field.code] || []}
                          onChange={(next) => setColumnFilter(cell.field!.code, next)}
                        />
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => {
                    if (!rowWritable(row)) return
                    const next = { ...row, orgOffice: resolveOrgOfficeFromCascade(cascade, row) }
                    setEdit(next)
                    setEditResultItems(row.resultItems?.length ? row.resultItems.map((x) => ({ ...x })) : pairResultItems(row))
                  }}
                  title={canWrite && !rowWritable(row) ? '当前角色对此行只读（超出本人层级渠道/单位/类型范围）' : undefined}
                  className={`${!row.validation.ok ? 'row-warning' : ''} ${rowWritable(row) ? 'cursor-pointer' : canWrite ? 'opacity-80' : ''}`}
                >
                  {tableFields.map((field) => {
                    const value = transitionCellValue(row, field)
                    const isNumber = field.number || typeof (row as unknown as Record<string, unknown>)[field.code] === 'number'
                    const isResultField = RESULT_FIELD_CODES.has(field.code)
                    const title = isResultField ? (resultItemsTitle(row) || value) : value
                    return (
                      <td
                        key={field.code}
                        title={title}
                        className={`${isNumber ? 'num text-right' : ''} ${field.code === 'name' ? 'font-medium text-ink' : ''} ${isResultField ? 'excel-result-cell' : ''}`}
                        style={{ minWidth: fieldMinWidth(field), maxWidth: fieldMinWidth(field) + 70 }}
                      >
                        {value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty text="当前筛选条件下暂无记录" />}
          {rows.length > 0 && tableFields.length === 0 && (
            <Empty text="当前已收起全部列，请在「列配置」中勾选要显示的字段" />
          )}
        </div>
      </Card>}

      {activeTab === 'split' && (
        <div className="grid grid-cols-12 gap-4">
          <Card title="按项目类型拆分专项分表" className="col-span-12 xl:col-span-8" pad={false}>
            <table className="dtable">
              <thead><tr><th>项目类型</th><th>项目类型主管</th><th>记录数</th><th className="text-right">总经费(万元)</th><th>问题行</th><th>分发/导出</th></tr></thead>
              <tbody>
                {data.subtables.map((item) => {
                  const owner = ownerByType.get(item.name)
                  return (
                    <tr key={item.name}>
                      <td className="font-medium">{item.name}</td>
                      <td>
                        <div className="text-[12px] text-ink">{owner?.ownerName || '待配置项目类型主管'}</div>
                        <div className="text-[10.5px] text-faint">
                          {owner?.canImport === false ? '禁用上传' : '可上传'} · {owner?.canExport === false ? '禁用导出' : '可导出'}
                        </div>
                      </td>
                      <td className="num text-dim">{item.count}</td>
                      <td className="num text-right">{wan(item.totalBudget, 1)}</td>
                      <td>{item.invalid ? <Tag tone="yellow">{item.invalid} 行</Tag> : <Tag tone="green">通过</Tag>}</td>
                      <td>
                        {canExport ? (
                          <button
                            className="cursor-pointer"
                            onClick={() => download(`/transition-tool/export.xlsx?projectType=${encodeURIComponent(item.name)}`, `专项分表-${item.name}.xlsx`)}
                            title={`仅下载「${item.name}」专项分表`}
                          >
                            <Tag tone="accent">下载 {item.name}</Tag>
                          </button>
                        ) : (
                          <Tag tone="dim">无导出权</Tag>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {data.subtables.length === 0 && <Empty text="暂无可拆分的项目类型" />}
          </Card>
          <Card title={<span className="flex items-center gap-2"><Users size={15} />主管分工与分发表规则</span>} className="col-span-12 xl:col-span-4">
            <div className="flex flex-col gap-3 text-[12px] text-dim">
              <div>拆分依据：严格按 Excel 字段 <span className="text-ink">{data.templateRules.splitField}</span> 分组，项目类型下拉对应模板 <span className="text-ink">{data.templateRules.splitFieldSource}</span>。</div>
              <div>分表格式：每个专项分表保留完整 {data.templateRules.totalColumnCount} 列表头、合并单元格、列顺序和下拉字典。</div>
              <div>主管维护：项目类型主管登录后只维护本人负责的专项分表，确认入库并自动留痕；总部可配置主管授权。</div>
              <div className="rounded-lg border border-line2 p-2.5 max-h-[210px] overflow-y-auto">
                {data.typeOwners.slice(0, 14).map((owner) => (
                  <div key={owner.projectType} className="flex items-center justify-between gap-2 py-1.5 border-b border-line last:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate text-ink">{owner.projectType}</div>
                      <div className="text-[10.5px] text-faint">{owner.ownerName}</div>
                    </div>
                    <Tag tone={owner.count ? 'accent' : 'dim'}>{owner.count} 行</Tag>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-line flex gap-2 flex-wrap">
                {canExportAll && (
                  <Btn variant="primary" disabled={busy} onClick={() => download(`/transition-tool/export-package.zip${exportQuery}`, exportZipName)}>
                    <Download size={14} />{projectType ? `导出 ${projectType} 分表包` : '导出筛选总表+分表包'}
                  </Btn>
                )}
                {canExport ? (
                  <Btn disabled={busy} onClick={() => download(`/transition-tool/export.xlsx${exportQuery}`, exportExcelName)}>
                    <Download size={14} />导出 {exportLabel} Excel
                  </Btn>
                ) : (
                  <Tag tone="dim">当前角色按 V19 无导出权限</Tag>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="grid grid-cols-12 gap-4">
          <Card title="最近导入批次" className="col-span-12 xl:col-span-7" pad={false}>
            <div className="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
              {pendingBatches.length > 0 && <Tag tone="accent">待确认 {pendingBatches.length} 批</Tag>}
              {!canWrite && <Tag tone="yellow">当前账号只读，不可上传</Tag>}
              <button type="button" className="chip ml-auto inline-flex items-center gap-1" onClick={() => setShowUploadGuide((v) => !v)}>
                导入说明
                <ChevronDown size={12} className={`transition-transform ${showUploadGuide ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {showUploadGuide && (
              <div className="px-4 py-3 border-b border-line text-[12px] text-dim space-y-1.5 bg-[rgba(17,26,46,0.4)]">
                {(data.workflow || []).slice(0, 5).map((step, i) => (
                  <div key={step} className="flex gap-2"><span className="num text-accent">{i + 1}</span><span>{step}</span></div>
                ))}
                <div className="pt-1 text-[11px] text-faint">
                  {(data.railDesign?.formMaintenance || DEFAULT_RAIL_DESIGN.formMaintenance).join(' · ')}
                </div>
              </div>
            )}
            <div className="p-3 flex flex-col gap-2 max-h-[calc(100vh-380px)] overflow-y-auto">
              {[...data.batches].sort((a, b) => {
                const rank = (s: string) => (s === '待确认' || s === '待修正' ? 0 : s === '已入库' ? 1 : 2)
                return rank(a.status) - rank(b.status) || b.id - a.id
              }).map((b) => (
                <div key={b.id} className="rounded-lg border border-line2 px-3 py-2.5">
                  <button type="button" onClick={() => openBatch(b.id)}
                    className="w-full text-left cursor-pointer hover:opacity-95">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] text-ink truncate grow">{b.file_name}</span>
                      <Tag tone={b.status === '已入库' ? 'green' : b.status === '待确认' ? 'accent' : b.status === '待修正' ? 'yellow' : b.status === '已撤回' ? 'yellow' : 'dim'}>{b.status}</Tag>
                    </div>
                    <div className="text-[10.5px] text-faint mt-1">解析 {b.parsed_count} · 新增 {b.added_count} · 更新 {b.updated_count} · 问题 {b.invalid_count}</div>
                    <div className="text-[10.5px] text-faint mt-0.5">{b.uploaded_by} · {b.uploaded_at}</div>
                  </button>
                  {canWrite && b.status === '已入库' && (
                    <div className="mt-2 flex justify-end">
                      <Btn
                        size="sm"
                        disabled={busy || b.canUndo === false}
                        title={b.canUndo === false ? (b.undoBlockReason || '当前不可撤回') : '撤回本批已入库变更'}
                        onClick={() => setUndoTarget({ kind: 'batch', batch: b })}
                      >
                        <RotateCcw size={12} />撤回本批
                      </Btn>
                    </div>
                  )}
                </div>
              ))}
              {data.batches.length === 0 && <Empty text="暂无导入批次，请先上传 Excel" />}
            </div>
          </Card>
          <Card title="快捷说明" className="col-span-12 xl:col-span-5">
            <div className="text-[12px] text-dim space-y-3">
              <div>
                <div className="text-[11px] tracking-wider text-faint mb-1.5">自动台账</div>
                {(data.railDesign?.autoLedger || DEFAULT_RAIL_DESIGN.autoLedger).map((x) => (
                  <div key={x} className="py-0.5">· {x}</div>
                ))}
              </div>
              <div className="border-t border-line pt-3">
                <div className="text-[11px] tracking-wider text-faint mb-1.5">操作提示</div>
                <div className="py-0.5">· 上传后先预校验，确认无误再入库</div>
                <div className="py-0.5">· 待确认批次会显示在上方列表顶部</div>
                <div className="py-0.5">· 成果多行用逗号/换行即可，不会拆成多条项目</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-12 gap-4">
          <Card title="字段变更明细" className="col-span-12" pad={false}>
            <div className="px-4 py-2 border-b border-line text-[11.5px] text-faint flex items-center gap-2 flex-wrap">
              <span>入库批次请到「批量上传」查看与撤回</span>
              <button type="button" className="chip text-accent border-[rgba(56,189,248,0.3)]" onClick={() => setActiveTab('upload')}>
                前往批量上传
              </button>
            </div>
            <div className="overflow-x-auto max-h-[520px]">
              <table className="dtable">
                <thead><tr><th>动作</th><th>项目类型</th><th>项目名称</th><th>字段</th><th>变更前</th><th>变更后</th><th>操作人</th><th>时间</th><th>操作</th></tr></thead>
                <tbody>
                  {data.changeLogs.flatMap((log) => {
                    const diffs = log.diff.length ? log.diff : [{ code: '', field: '整行', before: '', after: '' }]
                    const actionLabel = log.action === 'add' ? '新增'
                      : log.action === 'delete' ? '删除'
                        : log.action === 'manual' ? '手工维护'
                          : log.action === 'undo' ? '撤回'
                            : log.undone ? '已撤回' : '更新'
                    const actionTone = log.action === 'add' ? 'green'
                      : log.action === 'delete' ? 'red'
                        : log.action === 'manual' ? 'violet'
                          : log.action === 'undo' || log.undone ? 'dim'
                            : 'accent' as const
                    return diffs.slice(0, 8).map((d, i) => (
                      <tr key={`${log.id}-${d.code}-${i}`} className={log.undone ? 'opacity-55' : ''}>
                        <td><Tag tone={actionTone}>{actionLabel}</Tag></td>
                        <td className="text-dim">{log.projectType}</td>
                        <td className="max-w-[220px] truncate">{log.projectName}</td>
                        <td className="text-dim">{d.field}</td>
                        <td className="max-w-[180px] truncate text-faint">{d.before || '—'}</td>
                        <td className="max-w-[180px] truncate">{d.after || '—'}</td>
                        <td className="text-dim">{log.changedBy}</td>
                        <td className="text-faint">{log.changedAt}</td>
                        <td>
                          {i === 0 && canWrite && !log.batchId && log.action !== 'undo' ? (
                            <Btn
                              size="sm"
                              disabled={busy || log.canUndo === false || Boolean(log.undone)}
                              title={log.undone ? '已撤回' : (log.canUndo === false ? (log.undoBlockReason || '当前不可撤回') : '撤回该步变更')}
                              onClick={() => setUndoTarget({ kind: 'log', log })}
                            >
                              <RotateCcw size={12} />撤回
                            </Btn>
                          ) : i === 0 && log.batchId ? (
                            <span className="text-[11px] text-faint" title="请在批量上传使用「撤回本批」">批次</span>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
              {data.changeLogs.length === 0 && <Empty text="暂无字段变更明细" />}
            </div>
          </Card>
          {(data.pending || []).length > 0 && (
            <Card title="仍需正式接口确认" className="col-span-12">
              <div className="flex flex-wrap gap-2">
                {(data.pending || []).map((p) => <Tag key={p} tone="yellow">{p}</Tag>)}
              </div>
            </Card>
          )}
        </div>
      )}

      <Modal open={!!activeBatch} onClose={() => { setActiveBatchId(null); setImportShowProblemsOnly(true) }} title="导入批次校验预览" width={1080}>
        {activeBatch && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-6 gap-3">
              <KPI label="解析记录" value={activeBatch.parsed_count} unit="行" />
              <KPI label="待新增" value={activeBatch.added_count} unit="行" tone="green" />
              <KPI label="待更新" value={activeBatch.updated_count} unit="行" tone="accent" />
              <KPI label="无变化" value={activeBatch.report.unchanged || 0} unit="行" />
              <KPI label="待删除" value={activeBatch.report.removed || 0} unit="行" tone={(activeBatch.report.removed || 0) ? 'yellow' : 'green'} />
              <KPI label="问题行" value={activeBatch.invalid_count} unit="行" tone={activeBatch.invalid_count ? 'yellow' : 'green'} />
            </div>

            <div className="rounded-lg border border-line2 px-3.5 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                {activeBatch.invalid_count ? <XCircle size={16} className="text-syellow" /> : <CheckCircle2 size={16} className="text-sgreen" />}
                <div className="text-[12.5px] font-medium">{activeBatch.file_name}</div>
                <Tag tone={activeBatch.mode === 'replace' ? 'yellow' : 'accent'}>{activeBatch.mode === 'replace' ? '总表替换' : '分表合并'}</Tag>
                <Tag tone={activeBatch.status === '待确认' ? 'accent' : activeBatch.status === '待修正' ? 'yellow' : 'dim'}>{activeBatch.status}</Tag>
              </div>
              <div className="text-[11.5px] text-faint mt-1.5">上传人：{activeBatch.uploaded_by} · 上传时间：{activeBatch.uploaded_at}</div>
              {activeBatch.issues.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {activeBatch.issues.slice(0, 4).map((x, i) => <div key={i} className="text-[11.5px] text-syellow">{x.sheet || '工作表'}：{x.issue}</div>)}
                </div>
              )}
            </div>

            {activeBatch.invalid_count > 0 && (
              <div className="rounded-lg border border-[rgba(251,191,36,0.36)] bg-[rgba(251,191,36,0.08)] px-3.5 py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="text-[13px] font-semibold text-syellow">具体问题（{activeBatchProblemRows.length} 行）</div>
                  <label className="flex items-center gap-1.5 text-[11.5px] text-dim cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-cyan-400"
                      checked={importShowProblemsOnly}
                      onChange={(e) => setImportShowProblemsOnly(e.target.checked)}
                    />
                    下方列表仅显示问题行
                  </label>
                </div>
                <div className="text-[11.5px] text-faint mb-2.5">
                  以下按问题类型汇总；点开每行「查看详情」可看完整说明与经费三项数值。修正 Excel 后请重新上传。
                </div>
                <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto">
                  {activeBatchProblemGroups.map((group, gi) => (
                    <div key={gi} className="rounded-md border border-[rgba(251,191,36,0.28)] bg-[rgba(8,15,29,0.45)] px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <Tag tone="yellow">{group.count} 行</Tag>
                        <div className="text-[12px] text-syellow leading-relaxed break-words grow">{group.issue}</div>
                      </div>
                      <div className="mt-1.5 text-[11px] text-faint leading-5">
                        示例：{group.samples.map((s) => `第${s.rowNo}行「${s.name}」`).join('；')}
                        {group.count > group.samples.length ? ` 等 ${group.count} 行` : ''}
                      </div>
                    </div>
                  ))}
                  {activeBatchProblemGroups.length === 0 && (
                    <div className="text-[12px] text-faint">未解析到行级问题明细，请查看下方表格。</div>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto max-h-[460px] rounded-lg border border-line">
              <table className="dtable">
                <thead><tr><th>变化状态</th><th>行号</th><th>项目类型</th><th>项目名称</th><th>具体问题 / 变化摘要</th><th>详情</th></tr></thead>
                <tbody>
                  {activeBatchVisibleRows.slice(0, 300).map((x) => {
                    const problemText = x.issue || x.validation.missing.concat(x.validation.warnings).join('；')
                    const isProblem = x.action === 'skip' || !x.validation.ok
                    return (
                    <Fragment key={x.id}>
                    <tr className={isProblem || x.action === 'update' || x.action === 'delete' ? 'bg-[rgba(251,191,36,0.045)]' : ''}>
                      <td>
                        <Tag tone={x.action === 'add' ? 'green' : x.action === 'update' ? 'yellow' : x.action === 'keep' ? 'dim' : x.action === 'delete' ? 'red' : 'yellow'}>
                          {x.action === 'add' ? '新增' : x.action === 'update' ? '有变更' : x.action === 'keep' ? '无变化' : x.action === 'delete' ? '将删除' : '校验失败'}
                        </Tag>
                      </td>
                      <td className="num text-dim">{x.rowNo || '—'}</td>
                      <td className="text-dim">{x.projectType || '未分类'}</td>
                      <td className="max-w-[220px] truncate" title={x.projectName || x.row.name || ''}>{x.projectName || x.row.name || '—'}</td>
                      <td className={`max-w-[420px] ${isProblem ? 'text-syellow' : x.action === 'update' || x.action === 'delete' ? 'text-syellow' : 'text-faint'}`}>
                        <div className="leading-relaxed break-words whitespace-normal">
                          {isProblem
                            ? (problemText || '校验未通过')
                            : (x.action === 'update' ? `${x.diff.length} 项字段发生变化` : x.action === 'add' ? `${x.diff.length} 项信息将新增` : x.action === 'keep' ? '与当前总表完全一致' : x.action === 'delete' ? '确认后从总表删除' : problemText)}
                        </div>
                      </td>
                      <td>
                        <Btn onClick={() => setExpandedImportRows((old) => {
                          const next = new Set(old)
                          if (next.has(x.id)) next.delete(x.id); else next.add(x.id)
                          return next
                        })}>{expandedImportRows.has(x.id) ? '收起详情' : '查看详情'}</Btn>
                      </td>
                    </tr>
                    {expandedImportRows.has(x.id) && (
                      <tr>
                        <td colSpan={6} className="!p-0 bg-[rgba(8,15,29,0.72)]">
                          <div className="px-4 py-3 flex flex-col gap-3">
                            {isProblem && (
                              <div>
                                <div className="text-[11.5px] text-dim mb-1.5">校验问题明细</div>
                                <ul className="list-disc pl-5 text-[12px] text-syellow leading-6">
                                  {(x.validation.missing.length || x.validation.warnings.length)
                                    ? [...x.validation.missing, ...x.validation.warnings].map((msg, i) => <li key={i} className="break-words">{msg}</li>)
                                    : <li className="break-words">{problemText || '校验未通过'}</li>}
                                </ul>
                                <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
                                  <div className="rounded border border-line2 px-2.5 py-2">
                                    <div className="text-faint">总经费</div>
                                    <div className="num text-ink mt-0.5">{x.row.totalBudget ?? '—'}</div>
                                  </div>
                                  <div className="rounded border border-line2 px-2.5 py-2">
                                    <div className="text-faint">国拨经费</div>
                                    <div className="num text-ink mt-0.5">{x.row.centralGrant ?? '—'}</div>
                                  </div>
                                  <div className="rounded border border-line2 px-2.5 py-2">
                                    <div className="text-faint">自筹经费</div>
                                    <div className="num text-ink mt-0.5">{x.row.selfFund ?? '—'}</div>
                                  </div>
                                </div>
                                <div className="mt-1.5 text-[11px] text-faint">
                                  合计核对：国拨 {Number(x.row.centralGrant) || 0} + 自筹 {Number(x.row.selfFund) || 0} = {(Number(x.row.centralGrant) || 0) + (Number(x.row.selfFund) || 0)}；须等于总经费 {x.row.totalBudget ?? '—'}
                                </div>
                              </div>
                            )}
                            {x.diff.length > 0 && (
                              <div>
                                <div className="text-[11.5px] text-dim mb-2">逐字段对比 · 共 {x.diff.length} 项</div>
                                <table className="w-full text-[11.5px]">
                                  <thead><tr className="text-faint"><th className="text-left py-1.5 pr-3">字段</th><th className="text-left py-1.5 pr-3">当前值</th><th className="text-left py-1.5">上传值</th></tr></thead>
                                  <tbody>{x.diff.map((d, i) => (
                                    <tr key={`${x.id}-${d.code}-${i}`} className="border-t border-line">
                                      <td className="py-2 pr-3 text-dim whitespace-nowrap">{d.field}</td>
                                      <td className="py-2 pr-3 text-faint max-w-[320px] break-words">{d.before || '—'}</td>
                                      <td className="py-2 text-syellow max-w-[320px] break-words">{d.after || '—'}</td>
                                    </tr>
                                  ))}</tbody>
                                </table>
                              </div>
                            )}
                            {!isProblem && x.diff.length === 0 && (
                              <div className="text-[12px] text-faint">该行无字段差异。</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {activeBatchVisibleRows.length === 0 && <Empty text={importShowProblemsOnly ? '当前批次没有问题行' : '该批次暂无行级明细'} />}
            </div>

            {activeBatch.invalid_count > 0 && (
              <div className="rounded-lg border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.08)] px-3 py-2.5 flex flex-col gap-2">
                <div className="text-[12px] text-syellow">
                  系统已标出问题行，仅供人工核对；是否入库由您确认。勾选下方选项后可继续确认入库。
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-cyan-400"
                    checked={forceImportIds.has(activeBatch.id)}
                    onChange={(e) => setForceImportIds((old) => {
                      const next = new Set(old)
                      if (e.target.checked) next.add(activeBatch.id); else next.delete(activeBatch.id)
                      return next
                    })}
                  />
                  <span className="text-[12px] text-syellow">我已查看上述具体问题，仍确认将本批次入库（含问题行）。</span>
                </label>
              </div>
            )}

            {(activeBatch.updated_count > 0 || (activeBatch.report.removed || 0) > 0) && (
              <label className="flex items-start gap-2.5 rounded-lg border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.08)] px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-cyan-400"
                  checked={reviewedBatchIds.has(activeBatch.id)}
                  onChange={(e) => setReviewedBatchIds((old) => {
                    const next = new Set(old)
                    if (e.target.checked) next.add(activeBatch.id); else next.delete(activeBatch.id)
                    return next
                  })}
                />
                <span className="text-[12px] text-syellow">我已逐项检查有变化的项目及字段，确认以上更新{(activeBatch.report.removed || 0) > 0 ? '和删除' : ''}内容。</span>
              </label>
            )}

            <div className="flex justify-end gap-2.5">
                {canWrite && ['待确认', '待修正'].includes(activeBatch.status) && <Btn disabled={busy} onClick={() => cancelBatch(activeBatch.id)}>取消批次</Btn>}
                {access?.canConfirm !== false && canWrite && (
                  <Btn
                    variant="primary"
                    disabled={
                      busy
                      || !['待确认', '待修正'].includes(activeBatch.status)
                      || (activeBatch.invalid_count > 0 && !forceImportIds.has(activeBatch.id))
                      || ((activeBatch.updated_count > 0 || (activeBatch.report.removed || 0) > 0) && !reviewedBatchIds.has(activeBatch.id))
                    }
                    onClick={() => confirmBatch(activeBatch.id)}
                  >
                    <CheckCircle2 size={14} />确认入库
                  </Btn>
                )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!undoTarget} onClose={() => setUndoTarget(null)} title="确认撤回" width={480}>
        {undoTarget && (
          <div className="flex flex-col gap-3.5">
            {undoTarget.kind === 'log' ? (
              <>
                <p className="text-[13px] text-dim leading-relaxed">
                  将撤回「{undoTarget.log.projectName || undoTarget.log.identityKey}」的本次
                  {undoTarget.log.action === 'add' ? '新增' : '在线编辑'}，字段将按变更前快照还原。
                </p>
                <div className="rounded-lg border border-line2 px-3 py-2 text-[12px] text-faint">
                  操作人 {undoTarget.log.changedBy} · {undoTarget.log.changedAt}
                  {undoTarget.log.diff?.length ? ` · ${undoTarget.log.diff.length} 个字段` : ''}
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-dim leading-relaxed">
                  将撤回已入库批次「{undoTarget.batch.file_name}」
                  （{undoTarget.batch.mode === 'replace' ? '整表替换，按确认前备份恢复' : `合并入库，约影响新增 ${undoTarget.batch.added_count} / 更新 ${undoTarget.batch.updated_count} 行`}）。
                </p>
                <div className="rounded-lg border border-line2 px-3 py-2 text-[12px] text-faint">
                  确认人 {undoTarget.batch.confirmed_by || '—'} · {undoTarget.batch.confirmed_at || '—'}
                </div>
              </>
            )}
            <div className="text-[11.5px] text-syellow">撤回后将写入留痕并再备份一次；若项目后续又被修改，需先撤回更新步骤。</div>
            <div className="flex justify-end gap-2.5">
              <Btn disabled={busy} onClick={() => setUndoTarget(null)}>取消</Btn>
              <Btn variant="primary" disabled={busy} onClick={submitUndo}>
                <RotateCcw size={14} />确认撤回
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => { setEdit(null); setEditResultItems([]) }} title="维护专项分表记录" width={860}>
        {edit && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="序号"><Input value={edit.serial || ''} onChange={(e) => setEdit({ ...edit, serial: e.target.value, code: e.target.value })} /></Field>
              <Field label="项目名称" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="项目级别" required>
                <Select
                  value={edit.level}
                  onChange={(e) => applyEditCascade(edit, { level: e.target.value }, 'level')}
                >
                  {LEVELS.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="项目来源/渠道" required>
                <Select
                  value={edit.sourceChannel || edit.channel || ''}
                  onChange={(e) => applyEditCascade(edit, { sourceChannel: e.target.value }, 'sourceChannel')}
                >
                  <option value="">请选择</option>
                  {editSourceOptions.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="司局/处室">
                <Select
                  value={edit.orgOffice || resolveOrgOfficeFromCascade(cascade, edit) || ''}
                  onChange={(e) => applyEditCascade(edit, { orgOffice: e.target.value }, 'orgOffice')}
                >
                  <option value="">请选择（辅助，不写 Excel）</option>
                  {editOfficeOptions.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="项目类型" required>
                <Select
                  value={edit.projectType || edit.sourceSheet || ''}
                  onChange={(e) => applyEditCascade(edit, { projectType: e.target.value }, 'projectType')}
                >
                  <option value="">请选择</option>
                  {(isOwnerMode && ownedTypes.length ? ownedTypes.filter((x) => editProjectTypeOptions.includes(x) || !editProjectTypeOptions.length) : editProjectTypeOptions)
                    .map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="一级专业">
                <Select
                  value={edit.major1 || ''}
                  onChange={(e) => {
                    const nextMajor1 = e.target.value
                    const nextMajor2List = filterMajor2Options(cascade, data.dictionaries.major2 || [], nextMajor1)
                    const nextMajor2 = nextMajor2List.includes(edit.major2 || '') ? edit.major2 : ''
                    setEdit({ ...edit, major1: nextMajor1, major2: nextMajor2 || '' })
                  }}
                >
                  <option value="">请选择</option>
                  {data.dictionaries.major1.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="二级专业">
                <Select value={edit.major2 || ''} onChange={(e) => setEdit({ ...edit, major2: e.target.value })}>
                  <option value="">请选择</option>
                  {editMajor2Options.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="所中心"><Input value={edit.center || ''} onChange={(e) => setEdit({ ...edit, center: e.target.value })} /></Field>
              <Field label="责任单位" required><Input value={edit.responsibleUnit || ''} onChange={(e) => setEdit({ ...edit, responsibleUnit: e.target.value })} /></Field>
              <Field label="项目状态" required>
                <Select value={edit.projectStatus || ''} onChange={(e) => setEdit({ ...edit, projectStatus: e.target.value })}>
                  <option value="">请选择</option>
                  {(data.filterOptions.statuses || ['已完成', '进行中', '延期']).map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="内部负责人"><Input value={edit.owner || ''} onChange={(e) => setEdit({ ...edit, owner: e.target.value })} /></Field>
              <Field label="总经费(万元)" required><Input type="number" min="0" value={edit.totalBudget ?? ''} onChange={(e) => setEdit({ ...edit, totalBudget: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
              <Field label="国拨经费 + 自筹经费(万元)">
                <div className="grid grid-cols-2 gap-2">
                  <Input aria-label="国拨经费(万元)" placeholder="国拨经费" type="number" min="0" value={edit.centralGrant ?? ''} onChange={(e) => setEdit({ ...edit, centralGrant: e.target.value === '' ? null : Number(e.target.value) })} />
                  <Input aria-label="自筹经费(万元)" placeholder="自筹经费" type="number" min="0" value={edit.selfFund ?? ''} onChange={(e) => setEdit({ ...edit, selfFund: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
              </Field>
            </div>
            {editFunding && (
              <div className={`rounded-lg border px-3 py-2.5 text-[12px] ${editFunding.ok ? 'border-[rgba(52,211,153,0.28)] bg-[rgba(52,211,153,0.07)] text-sgreen' : 'border-[rgba(251,191,36,0.36)] bg-[rgba(251,191,36,0.09)] text-syellow'}`}>
                <div>经费关系：国拨 {editFunding.grant.toLocaleString('zh-CN')} + 自筹 {editFunding.self.toLocaleString('zh-CN')} = {editFunding.sum.toLocaleString('zh-CN')} 万元</div>
                <div className="mt-1">{editFunding.ok ? '与总经费一致，校验通过' : editFunding.issues.join('；')}</div>
              </div>
            )}
            <div className="rounded-lg border border-line2 p-3">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div>
                  <div className="text-[12.5px] font-semibold">成果明细（自动分行）</div>
                  <div className="text-[11px] text-faint mt-0.5">
                    导入时自动识别换行/逗号并拆成明细；产生成果名称与转化名称、年月、型号按行对应。仍是一条项目记录，经费统计不重复。
                  </div>
                </div>
                <Btn
                  size="sm"
                  onClick={() => setEditResultItems((old) => [...old, { resultName: '', convertedName: '', convertedMonth: '', convertedModel: '' }])}
                >
                  添加一条
                </Btn>
              </div>
              {editResultItems.length === 0 ? (
                <div className="text-[12px] text-faint py-3">暂无成果明细。可点击「添加一条」，或保存时保持为空。</div>
              ) : (
                <div className="overflow-x-auto max-h-[260px]">
                  <table className="dtable">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th>产生成果名称</th>
                        <th>转化成果名称</th>
                        <th>转化年月</th>
                        <th>转化型号</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editResultItems.map((item, index) => (
                        <tr key={`result-item-${index}`}>
                          <td className="num text-faint">{index + 1}</td>
                          <td>
                            <Input
                              value={item.resultName}
                              onChange={(e) => setEditResultItems((old) => old.map((x, i) => i === index ? { ...x, resultName: e.target.value } : x))}
                            />
                          </td>
                          <td>
                            <Input
                              value={item.convertedName}
                              onChange={(e) => setEditResultItems((old) => old.map((x, i) => i === index ? { ...x, convertedName: e.target.value } : x))}
                            />
                          </td>
                          <td>
                            <Input
                              placeholder="YYYY.M"
                              value={item.convertedMonth}
                              onChange={(e) => setEditResultItems((old) => old.map((x, i) => i === index ? { ...x, convertedMonth: e.target.value } : x))}
                            />
                          </td>
                          <td>
                            <Input
                              value={item.convertedModel}
                              onChange={(e) => setEditResultItems((old) => old.map((x, i) => i === index ? { ...x, convertedModel: e.target.value } : x))}
                            />
                          </td>
                          <td className="text-right">
                            <Btn
                              size="sm"
                              variant="danger"
                              onClick={() => setEditResultItems((old) => old.filter((_, i) => i !== index))}
                            >
                              删除
                            </Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <Field label="成果转化情况摘要"><Textarea rows={2} value={edit.transformSummary || ''} onChange={(e) => setEdit({ ...edit, transformSummary: e.target.value })} /></Field>
            {!edit.validation?.ok && (
              <div className="rounded-lg border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-[12px] text-syellow">
                {edit.validation.missing.concat(edit.validation.warnings).join('；') || '保存后将重新校验'}
              </div>
            )}
            <div className="flex justify-between gap-2.5 flex-wrap">
              <div>
                {canWrite && rowWritable(edit) && (
                  <Btn variant="danger" disabled={busy} onClick={removeProject} title="删除该项目在总表中的全部信息">
                    <Trash2 size={14} />删除项目
                  </Btn>
                )}
              </div>
              <div className="flex gap-2.5">
                <Btn onClick={() => { setEdit(null); setEditResultItems([]) }}>取消</Btn>
                {canWrite && <Btn variant="primary" disabled={busy || !editFunding?.ok} onClick={save}><Save size={14} />保存并留痕</Btn>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
