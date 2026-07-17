import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Download, FileSpreadsheet, Filter, Save, Search, UploadCloud, Users, XCircle } from 'lucide-react'
import { api, apiDownload, apiUpload } from '../../api/client'
import type { TransitionCascade, TransitionImportBatch, TransitionRow, TransitionToolData } from '../../api/types'
import { Btn, Card, Empty, Field, Input, KPI, Modal, Select, Tag, Textarea, useToast } from '../../components/ui'
import { wan } from '../../lib/format'
import { flattenCascadePaths, resolveCascade, resolveOrgOfficeFromCascade } from '../../lib/cascadePath'
import { useSession } from '../../store/session'

const LEVELS = ['国家级', '地方级', '公司级']
const OPERATOR_NO_KEY = 'form.operatorNo'
const DEFAULT_RAIL_DESIGN = {
  autoLedger: ['总表统一汇聚', '按权限自动筛选', '变更记录全程留痕'],
  formMaintenance: ['总表批量预校验', '分表增量预校验', '确认后统一入库'],
}
const DEFAULT_PENDING: string[] = []

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
  const [visibleGroups, setVisibleGroups] = useState<string[]>([])
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({})
  const [edit, setEdit] = useState<TransitionRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewBatches, setPreviewBatches] = useState<TransitionImportBatch[]>([])
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null)
  const [expandedImportRows, setExpandedImportRows] = useState<Set<number>>(new Set())
  const [reviewedBatchIds, setReviewedBatchIds] = useState<Set<number>>(new Set())
  const [operatorNo, setOperatorNo] = useState(() => {
    const fromUser = normalizeOperatorNo(user?.emp_no || '')
    return fromUser || localStorage.getItem(OPERATOR_NO_KEY) || ''
  })
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const uploadModeRef = useRef<UploadMode>('merge')

  const load = useCallback(() => {
    api.get<TransitionToolData>('/transition-tool').then((d) => {
      setData(d)
      const autoNo = normalizeOperatorNo(d.access?.defaultOperatorNo || user?.emp_no || '')
      if (autoNo) setOperatorNo((prev) => normalizeOperatorNo(prev) || autoNo)
    })
  }, [user?.emp_no])
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
        const hay = [r.serial, r.code, r.name, r.projectType, r.sourceChannel, r.orgOffice, r.responsibleUnit, r.demandUnit].join(' ').toLowerCase()
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
    () => [...(data?.fields || [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)),
    [data],
  )
  const allGroupNames = useMemo(() => {
    const groups = [...new Set(excelFields.map((field) => field.group))]
    if (visibleFieldGroups?.length) return groups.filter((g) => visibleFieldGroups.includes(g))
    return groups
  }, [excelFields, visibleFieldGroups])
  const tableFields = useMemo(() => {
    let fields = excelFields
    if (visibleFieldGroups?.length) fields = fields.filter((field) => visibleFieldGroups.includes(field.group))
    if (!visibleGroups.length) return fields
    return fields.filter((field) => visibleGroups.includes(field.group))
  }, [excelFields, visibleGroups, visibleFieldGroups])
  const excelGroups = useMemo(() => {
    const groups: { name: string; span: number }[] = []
    for (const field of tableFields) {
      const last = groups[groups.length - 1]
      if (last && last.name === field.group) last.span += 1
      else groups.push({ name: field.group, span: 1 })
    }
    return groups
  }, [tableFields])
  const latestBatch = useMemo(() => data?.batches[0] || null, [data])
  const currentTypeCount = useMemo(() => {
    const set = new Set(rows.map((r) => r.projectType || r.sourceSheet).filter(Boolean))
    return set.size
  }, [rows])
  const activeBatch = useMemo(
    () => previewBatches.find((x) => x.id === activeBatchId) || null,
    [previewBatches, activeBatchId],
  )
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
      const text = `${row.responsibleUnit || ''} ${row.demandUnit || ''}`
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

  const importDemo = async () => {
    setBusy(true)
    try {
      const r = await api.post<{ imported: number }>('/transition-tool/import-demo')
      toast(`已加载全面样本案例 ${r.imported} 行（覆盖国家/地方/公司级联与专业）`)
      setActiveTab('master')
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
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
      setActiveBatchId(r.batch.id)
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const confirmBatch = async (id: number) => {
    const no = requireOperatorNo()
    if (!no) return
    setBusy(true)
    try {
      const r = await api.post<{ batch: TransitionImportBatch }>(`/transition-tool/import-batches/${id}/confirm`, { operatorNo: no })
      toast(`已确认入库：新增 ${r.batch.added_count} 行，更新 ${r.batch.updated_count} 行（工号 ${no}）`)
      setPreviewBatches((old) => old.filter((x) => x.id !== id))
      setActiveBatchId(null)
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

  const save = async () => {
    if (!edit) return
    const funding = fundingRelation(edit)
    if (!funding.ok) {
      toast(funding.issues[0], 'err')
      return
    }
    const no = requireOperatorNo()
    if (!no) return
    setBusy(true)
    try {
      await api.post('/transition-tool/records', { ...edit, operatorNo: no })
      toast(`分表记录已保存并留痕（工号 ${no}）`)
      setEdit(null); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const toggleGroup = (group: string) => {
    setVisibleGroups((old) => (
      old.includes(group)
        ? old.filter((x) => x !== group)
        : [...old, group]
    ))
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

  if (!data) return <div className="text-faint text-sm py-20 text-center">正在加载表单维护…</div>

  const typeSelectOptions = isOwnerMode && ownedTypes.length
    ? ownedTypes
    : projectTypeOptions

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold">表单维护</div>
          <div className="text-[11.5px] text-faint mt-0.5 max-w-[720px]">
            {access?.maintObject
              ? `维护对象：${access.maintObject}。查看：${access.rights?.read || '—'}；修改：${access.rights?.write || '—'}；导出：${access.rights?.export || '—'}。`
              : isOwnerMode
                ? `您是项目类型主管，当前仅可维护：${ownedTypes.join('、') || '（尚未授权类型）'}。`
                : '各角色权限按 V19 落地：总部维护总表，项目类型主管维护分表，其余角色只读。'}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Tag tone={access?.mode === 'hq' ? 'accent' : access?.mode === 'channel' ? 'yellow' : (access?.mode === 'owner' || access?.mode === 'unit') ? 'green' : 'dim'}>{access?.label || '未识别权限'}</Tag>
          {access?.roleLabel && <Tag tone="dim">{access.roleLabel}</Tag>}
          {!canWrite && <Tag tone="yellow">只读</Tag>}
          {canWrite && access?.mode === 'hq' && <Tag tone="green">可改全部</Tag>}
          {canWrite && isChannelMode && <Tag tone="yellow">本层级渠道可写</Tag>}
          {canWrite && isUnitMode && <Tag tone="green">本单位可写</Tag>}
          {canWrite && isOwnerMode && <Tag tone="green">本人分表可写</Tag>}
          {isChannelMode && ownedLevels.length > 0 && <Tag tone="dim">层级 {ownedLevels.join('、')}</Tag>}
          {canExport ? <Tag tone="accent">可导出</Tag> : <Tag tone="dim">禁导出</Tag>}
        </div>
      </div>

      <Card pad className="!p-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <input ref={uploadRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => importFiles(e.target.files)} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input aria-label="搜索" placeholder="序号 / 项目名称 / 编号" value={kw} onChange={(e) => setKw(e.target.value)} style={{ width: 230, paddingLeft: 32 }} />
          </div>
          <Select aria-label="层级" value={level} onChange={(e) => onFilterLevelChange(e.target.value)} style={{ width: 108 }}>
            <option value="">全部层级</option>
            {(data.filterOptions.levels || cascade.levels || LEVELS).map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="项目来源/渠道" value={channel} onChange={(e) => onFilterChannelChange(e.target.value)} style={{ width: 140 }}>
            <option value="">全部渠道</option>
            {sourceChannelOptions.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="司局/处室" value={office} onChange={(e) => onFilterOfficeChange(e.target.value)} style={{ width: 140 }} title="筛选辅助，不写入 Excel">
            <option value="">全部司局/处室</option>
            {officeOptions.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="项目类型" value={projectType} onChange={(e) => onFilterTypeChange(e.target.value)} style={{ width: 200 }}>
            <option value="">{isOwnerMode ? '我负责的全部类型' : '全部项目类型'}</option>
            {typeSelectOptions.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="单位" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 150 }}>
            <option value="">全部单位</option>
            {data.filterOptions.units.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 120 }}>
            <option value="">全部状态</option>
            {data.filterOptions.statuses.map((x) => <option key={x}>{x}</option>)}
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
          <div className="grow" />
          {canImportMaster && <Btn disabled={busy} onClick={importDemo}><FileSpreadsheet size={14} />加载样本案例</Btn>}
          {canImportMaster && <Btn disabled={busy} onClick={() => pickFiles('replace')}><UploadCloud size={14} />上传总表预校验</Btn>}
          {canWrite && <Btn disabled={busy} onClick={() => pickFiles('merge')}><UploadCloud size={14} />上传分表预校验</Btn>}
          {canExport ? (
            <Btn
              variant="primary"
              disabled={busy}
              title={`按当前筛选导出：${exportLabel}`}
              onClick={() => download(`/transition-tool/export.xlsx${exportQuery}`, exportExcelName)}
            >
              <Download size={14} />导出 {projectType ? projectType : '当前筛选'} Excel
            </Btn>
          ) : (
            <Tag tone="dim">当前角色无导出权限</Tag>
          )}
          {canExportAll && (
            <Btn
              variant="primary"
              disabled={busy}
              title={projectType ? `仅打包「${projectType}」专项分表` : `打包当前筛选下各专项分表：${exportLabel}`}
              onClick={() => download(`/transition-tool/export-package.zip${exportQuery}`, exportZipName)}
            >
              <Download size={14} />{projectType ? `导出 ${projectType} 分表包` : '导出筛选分表包'}
            </Btn>
          )}
        </div>
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
          </button>
        ))}
      </div>

      {activeTab === 'master' && <Card
        title={<span className="flex items-center gap-2"><FileSpreadsheet size={15} />预先研究项目信息</span>}
        extra={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Tag tone="accent">项目 {filteredSummary.total} 个</Tag>
            <Tag tone="dim">类型 {currentTypeCount} 个</Tag>
            <Tag tone="accent">总经费 {wan(filteredSummary.budget, 1)} 万</Tag>
            <Tag tone="dim">国拨 {wan(filteredSummary.centralGrant, 1)} 万</Tag>
            <Tag tone="dim">自筹 {wan(filteredSummary.selfFund, 1)} 万</Tag>
            <Tag tone="accent">执行中 {filteredSummary.executing}</Tag>
            <Tag tone="green">已完成 {filteredSummary.completed}</Tag>
            {filteredSummary.delayed > 0 && <Tag tone="red">延期 {filteredSummary.delayed}</Tag>}
            <Tag tone={filteredSummary.invalid ? 'yellow' : 'green'}>{filteredSummary.invalid ? `待修正 ${filteredSummary.invalid}` : '校验通过'}</Tag>
            {data.summary.duplicates.length > 0 && <Tag tone="yellow">重复 {data.summary.duplicates.length}</Tag>}
            {latestBatch && <button onClick={() => openBatch(latestBatch.id)} className="chip hover:text-accent">{latestBatch.status} · {latestBatch.file_name}</button>}
          </div>
        }
        pad={false}
        className="overflow-hidden"
      >
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-line">
          <span className="text-[11px] text-faint">自定义显示列：</span>
          <button onClick={() => setVisibleGroups([])} className={`chip ${visibleGroups.length === 0 ? 'text-accent border-[rgba(56,189,248,0.35)]' : ''}`}>全部字段</button>
          {allGroupNames.map((group) => (
            <button key={group} onClick={() => toggleGroup(group)} className={`chip ${visibleGroups.includes(group) ? 'text-accent border-[rgba(56,189,248,0.35)]' : ''}`}>
              {group}
            </button>
          ))}
          {activeColFilterCount > 0 && (
            <button
              type="button"
              className="chip text-accent border-[rgba(56,189,248,0.35)]"
              onClick={() => setColFilters({})}
              title="清除所有列表头筛选"
            >
              清除列筛选 ({activeColFilterCount})
            </button>
          )}
          <span className="text-[11px] text-faint">表头漏斗可按列勾选筛选；导出仍按完整 A:AN 模板输出。</span>
        </div>
        <div className="overflow-x-auto max-h-[calc(100vh-260px)]">
          <table className="excel-ledger-table">
            <thead>
              <tr>
                {excelGroups.map((group) => (
                  <th key={group.name} colSpan={group.span} className="excel-group">{group.name}</th>
                ))}
              </tr>
              <tr>
                {tableFields.map((field, i) => (
                  <th key={field.code} style={{ minWidth: fieldMinWidth(field) }}>
                    <div className="excel-th-main">
                      <div className="min-w-0">
                        <span className="excel-col">{excelColName(field.index ?? i)}</span>
                        <span className="excel-th-label">{field.label}</span>
                      </div>
                      <ColumnFilterButton
                        field={field}
                        options={columnFilterOptions[field.code] || []}
                        selected={colFilters[field.code] || []}
                        onChange={(next) => setColumnFilter(field.code, next)}
                      />
                    </div>
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
                    setEdit({ ...row, orgOffice: resolveOrgOfficeFromCascade(cascade, row) })
                  }}
                  title={canWrite && !rowWritable(row) ? '当前角色对此行只读（超出本人层级渠道/单位/类型范围）' : undefined}
                  className={`${!row.validation.ok ? 'row-warning' : ''} ${rowWritable(row) ? 'cursor-pointer' : canWrite ? 'opacity-80' : ''}`}
                >
                  {tableFields.map((field) => {
                    const value = transitionCellValue(row, field)
                    const isNumber = field.number || typeof (row as unknown as Record<string, unknown>)[field.code] === 'number'
                    return (
                      <td
                        key={field.code}
                        title={value}
                        className={`${isNumber ? 'num text-right' : ''} ${field.code === 'name' ? 'font-medium text-ink' : ''}`}
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
          <Card title="五步导入闭环" className="col-span-4">
            <div className="flex flex-col gap-2">
              {data.workflow.map((step, i) => (
                <div key={step} className="flex items-center gap-2 rounded-lg border border-line2 px-3 py-2">
                  <span className="num text-accent">{i + 1}</span>
                  <span className="text-[12.5px]">{step}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              {canImportMaster && <Btn disabled={busy} onClick={() => pickFiles('replace')}><UploadCloud size={14} />上传总表</Btn>}
              {canWrite && <Btn disabled={busy} onClick={() => pickFiles('merge')}><UploadCloud size={14} />上传多个分表</Btn>}
              {!canWrite && <Tag tone="yellow">当前账号只读，不可上传</Tag>}
            </div>
          </Card>
          <Card title="双轨设计" className="col-span-4">
            <div className="text-[11px] tracking-wider text-faint mb-2">自动台账</div>
            <div className="flex flex-col gap-1.5 mb-4">
              {(data.railDesign?.autoLedger || DEFAULT_RAIL_DESIGN.autoLedger).map((x) => <div key={x} className="text-[12px] text-dim">· {x}</div>)}
            </div>
            <div className="text-[11px] tracking-wider text-faint mb-2">表单工具</div>
            <div className="flex flex-col gap-1.5">
              {(data.railDesign?.formMaintenance || DEFAULT_RAIL_DESIGN.formMaintenance).map((x) => <div key={x} className="text-[12px] text-dim">· {x}</div>)}
            </div>
          </Card>
          <Card title="最近导入批次" className="col-span-4">
            <div className="flex flex-col gap-2">
              {data.batches.map((b) => (
                <button key={b.id} onClick={() => openBatch(b.id)}
                  className="rounded-lg border border-line2 px-3 py-2 text-left cursor-pointer hover:border-[rgba(56,189,248,0.38)]">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-ink truncate grow">{b.file_name}</span>
                    <Tag tone={b.status === '已入库' ? 'green' : b.status === '待确认' ? 'accent' : b.status === '待修正' ? 'yellow' : 'dim'}>{b.status}</Tag>
                  </div>
                  <div className="text-[10.5px] text-faint mt-1">解析 {b.parsed_count} · 新增 {b.added_count} · 更新 {b.updated_count} · 问题 {b.invalid_count}</div>
                  <div className="text-[10.5px] text-faint mt-0.5">{b.uploaded_by} · {b.uploaded_at}</div>
                </button>
              ))}
              {data.batches.length === 0 && <Empty text="暂无导入批次" />}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-12 gap-4">
          <Card title="校验报告与批次记录" className="col-span-5" pad={false}>
            <table className="dtable">
              <thead><tr><th>批次</th><th>文件名</th><th>状态</th><th>问题</th><th>确认人</th></tr></thead>
              <tbody>
                {data.batches.map((b) => (
                  <tr key={b.id} className="clickable" onClick={() => openBatch(b.id)}>
                    <td className="num">{b.id}</td>
                    <td className="max-w-[220px] truncate">{b.file_name}</td>
                    <td><Tag tone={b.status === '已入库' ? 'green' : b.status === '待确认' ? 'accent' : b.status === '待修正' ? 'yellow' : 'dim'}>{b.status}</Tag></td>
                    <td className="num">{b.invalid_count}</td>
                    <td className="text-dim">{b.confirmed_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="字段变更明细" className="col-span-7" pad={false}>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="dtable">
                <thead><tr><th>动作</th><th>项目类型</th><th>项目名称</th><th>字段</th><th>变更前</th><th>变更后</th><th>操作人</th><th>时间</th></tr></thead>
                <tbody>
                  {data.changeLogs.flatMap((log) => {
                    const diffs = log.diff.length ? log.diff : [{ code: '', field: '整行', before: '', after: '' }]
                    return diffs.slice(0, 8).map((d, i) => (
                      <tr key={`${log.id}-${d.code}-${i}`}>
                        <td><Tag tone={log.action === 'add' ? 'green' : log.action === 'manual' ? 'violet' : 'accent'}>{log.action === 'add' ? '新增' : log.action === 'manual' ? '手工维护' : '更新'}</Tag></td>
                        <td className="text-dim">{log.projectType}</td>
                        <td className="max-w-[220px] truncate">{log.projectName}</td>
                        <td className="text-dim">{d.field}</td>
                        <td className="max-w-[180px] truncate text-faint">{d.before || '—'}</td>
                        <td className="max-w-[180px] truncate">{d.after || '—'}</td>
                        <td className="text-dim">{log.changedBy}</td>
                        <td className="text-faint">{log.changedAt}</td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
              {data.changeLogs.length === 0 && <Empty text="暂无字段变更明细" />}
            </div>
          </Card>
          <Card title="仍需正式接口确认" className="col-span-12">
            <div className="flex flex-wrap gap-2">
              {(data.pending || DEFAULT_PENDING).map((p) => <Tag key={p} tone="yellow">{p}</Tag>)}
            </div>
          </Card>
        </div>
      )}

      <Modal open={!!activeBatch} onClose={() => setActiveBatchId(null)} title="导入批次校验预览" width={960}>
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
              <div className="flex items-center gap-2">
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

            <div className="overflow-x-auto max-h-[460px] rounded-lg border border-line">
              <table className="dtable">
                <thead><tr><th>变化状态</th><th>行号</th><th>项目类型</th><th>项目名称</th><th>变化摘要</th><th>逐项检查</th></tr></thead>
                <tbody>
                  {(activeBatch.rows || []).slice(0, 300).map((x) => (
                    <Fragment key={x.id}>
                    <tr className={x.action === 'update' || x.action === 'delete' ? 'bg-[rgba(251,191,36,0.045)]' : ''}>
                      <td>
                        <Tag tone={x.action === 'add' ? 'green' : x.action === 'update' ? 'yellow' : x.action === 'keep' ? 'dim' : x.action === 'delete' ? 'red' : 'yellow'}>
                          {x.action === 'add' ? '新增' : x.action === 'update' ? '有变更' : x.action === 'keep' ? '无变化' : x.action === 'delete' ? '将删除' : '校验失败'}
                        </Tag>
                      </td>
                      <td className="num text-dim">{x.rowNo || '—'}</td>
                      <td className="text-dim">{x.projectType || '未分类'}</td>
                      <td className="max-w-[280px] truncate">{x.projectName || x.row.name || '—'}</td>
                      <td className={x.action === 'update' || x.action === 'delete' ? 'text-syellow' : 'text-faint'}>
                        {x.issue || (x.action === 'update' ? `${x.diff.length} 项字段发生变化` : x.action === 'add' ? `${x.diff.length} 项信息将新增` : x.action === 'keep' ? '与当前总表完全一致' : x.action === 'delete' ? '确认后从总表删除' : x.validation.missing.concat(x.validation.warnings).join('；'))}
                      </td>
                      <td><Btn disabled={!x.diff.length} onClick={() => setExpandedImportRows((old) => {
                        const next = new Set(old)
                        if (next.has(x.id)) next.delete(x.id); else next.add(x.id)
                        return next
                      })}>{expandedImportRows.has(x.id) ? '收起明细' : '查看每项'}</Btn></td>
                    </tr>
                    {expandedImportRows.has(x.id) && x.diff.length > 0 && (
                      <tr>
                        <td colSpan={6} className="!p-0 bg-[rgba(8,15,29,0.72)]">
                          <div className="px-4 py-3">
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
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {(activeBatch.rows || []).length === 0 && <Empty text="该批次暂无行级明细" />}
            </div>

            {activeBatch.invalid_count > 0 && (
              <div className="rounded-lg border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-[12px] text-syellow">
                存在问题行，系统不会入库。请按校验说明修正 Excel 后重新上传。
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
                  <Btn variant="primary" disabled={busy || activeBatch.status !== '待确认' || activeBatch.invalid_count > 0 || ((activeBatch.updated_count > 0 || (activeBatch.report.removed || 0) > 0) && !reviewedBatchIds.has(activeBatch.id))} onClick={() => confirmBatch(activeBatch.id)}>
                    <CheckCircle2 size={14} />确认入库
                  </Btn>
                )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="维护专项分表记录" width={660}>
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
            <Field label="产生成果名称"><Textarea rows={2} value={edit.resultNames || ''} onChange={(e) => setEdit({ ...edit, resultNames: e.target.value, transformSummary: e.target.value || edit.transformSummary })} /></Field>
            <Field label="成果转化情况"><Textarea rows={2} value={edit.transformSummary || ''} onChange={(e) => setEdit({ ...edit, transformSummary: e.target.value })} /></Field>
            {!edit.validation?.ok && (
              <div className="rounded-lg border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-[12px] text-syellow">
                {edit.validation.missing.concat(edit.validation.warnings).join('；') || '保存后将重新校验'}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <Btn onClick={() => setEdit(null)}>取消</Btn>
              {canWrite && <Btn variant="primary" disabled={busy || !editFunding?.ok} onClick={save}><Save size={14} />保存并留痕</Btn>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
