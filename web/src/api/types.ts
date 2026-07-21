import type { Four } from '../lib/status'

export interface Team {
  owner: string; tech: string; pm: string; chief1: string; chief2: string
  hqHead: string; hqStaff: string; unitDeptHead: string; unitStaff: string
  finHq: string; finHead: string; finStaff: string
}

export interface Project {
  id: number; code: string; wbs: string | null; name: string; goal: string; year_goal: string | null
  level: string; channel_id: number; lead_unit_id: number
  partners: { name: string; work: string }[]
  team: Team; tags: string[]
  start: string; end: string; status: string; total_budget: number
  transform_status: string | null; accepted_at: string | null
  color: Four; msTotal: number; msDone: number; progress: number
  nextMilestone: { title: string; due: string; daysLeft: number } | null
  spentAll: number; yearBudget: number; yearSpent: number
  delivered: number; delivTotal: number
  v19: {
    major1: string; major2: string; launchMonth: string; endMonth: string; projectMonths: number | null
    managerUnit: string; demandUnit: string; responsibleUnit: string; leadWork: string; plannedPartners: string
    centralGrant: number; selfFund: number; internalFund: number; cumulativeSpent: number; closingActual: number | null
    executionRate: number; deliverableSummary: string; collaboratorSummary: string; transformCount: number; transformSummary: string
  }
}

export interface Milestone {
  id: number; project_id: number; year: number; seq: number; title: string
  due: string; done_at: string | null; evidence: string | null; delay_reason: string | null
  color: Four; daysLeft: number
}

export interface PlanRow {
  id: number; project_id: number; title: string; source: string; due: string
  done_at: string | null; status: string; color: Four
}

export interface Fund { id: number; project_id: number; year: number; budget: number; spent: number; writeoffs: { date: string; amount: number; voucher: string; note: string }[] }

export interface Deliverable { id: number; project_id: number; name: string; type: string; due: string | null; delivered_at: string | null; owner: string; package_id: number | null; color: Four }

export interface Pkg {
  id: number; code: string; name: string; project_id: number; mode: string; form: string
  plan_date: string | null; actual_date: string | null; status: string; brief: string; detail: string
  unit_id: number; color: Four; deliverableCount: number
}

export interface Collaborator {
  id: number; project_id: number; name: string; ctype: string
  scores: { tech: number; quality: number; schedule: number; service: number; compliance: number } | null
  total: number | null; grade: string | null; eval_date: string | null; evaluator: string | null
  blacklisted: number; note: string | null; pname?: string; pcode?: string
  deadline?: string | null; daysLeft?: number | null
}

export interface ApprovalStep { title: string; assignee: string; status: 'approved' | 'current' | 'pending' | 'rejected'; at: string | null; comment: string | null; actor?: string }

export interface Approval {
  id: number; type: string; title: string; project_id: number | null; initiator: string
  unit_id: number; created_at: string; status: string; current_step: number
  steps: ApprovalStep[]; payload: Record<string, unknown>
  projectName?: string; projectCode?: string
}

export interface AlertRow {
  id: number; project_id: number | null; kind: string; level: 'red' | 'yellow'; title: string
  due: string | null; created_at: string; channels: string; recipients: string; read: number
  pname?: string; pcode?: string
}

export interface PostEval {
  id: number; project_id: number; status: string; deadline: string; started_at: string | null
  finished_at: string | null; conclusion: string | null
  scores: { goal: number; schedule: number; budget: number; output: number; collab: number; risk: number } | null
  pname?: string; pcode?: string; total_budget?: number
}

export interface ChangeRow { id: number; project_id: number; kind: string; category: string; detail: string; reason: string; status: string; created_at: string }

export interface Doc { id: number; project_id: number; phase: string; name: string; uploaded_at: string; uploader: string; size_kb: number; file_path: string | null }

export interface ProjectFull extends Project {
  channelName: string; channelFlow: string[]; channelFiling: string[]; channelAssess: string[]; unitName: string; unitShort: string
  milestones: Milestone[]; plans: PlanRow[]; funds: Fund[]; deliverables: Deliverable[]
  packages: Pkg[]; collaborators: Collaborator[]; approvals: Approval[]
  changes: ChangeRow[]; documents: Doc[]; postEval: PostEval | null
}

export interface Dashboard {
  today: string
  kpis: {
    total: number; active: number; totalBudget: number; yearBudget: number; yearSpent: number
    execRate: number; totalExecRate: number; red: number; yellow: number; deliverables: number; packagesDone: number
    blacklist: number; pendingApprovals: number
  }
  byLevel: { level: string; count: number; budget: number }[]
  byUnit: { unit: string; count: number; budget: number; red: number; yellow: number; blue: number; green: number }[]
  unitLevelMatrix: { unit: string; 国家级: number; 地方级: number; 公司级: number; active: number; accepted: number }[]
  byChannel: { channel: string; key: string; level: string; count: number }[]
  fundsTrend: { year: number; budget: number; spent: number }[]
  statusDist: { status: string; count: number }[]
  delivByType: { type: string; delivered: number; pending: number }[]
  transform: { stage: string; count: number }[]
  transformSummary: { total: number; done: number; running: number; notStarted: number; overdue: number }
  modelTransform: { model: string; count: number; done: number; running: number; overdue: number }[]
  planStats: { total: number; todo: number; done: number; finishRate: number; colors: Record<Four, number>; cmosSync: string | null }
  fundStructure: {
    total: number; centralGrant: number; selfFund: number; internalFund: number
    activeTotal: number; activeCentralGrant: number; activeSelfFund: number; totalExecRate: number
  }
  risks: { kind: string; color: Four; project: string; projectId: number; title: string; due: string; days: number; unit: string }[]
  colorDist: { color: Four; count: number }[]
  msColors: Record<Four, number>
}

export interface TransformRow extends Pkg {
  pname: string; pcode: string; level: string; pstatus: string; unitShort: string
  deliverables: { name: string; type: string; delivered_at: string | null }[]
  target: string
}

export interface TransformationData {
  rows: TransformRow[]
  stats: { total: number; model: number; market: number; done: number; overdue: number }
  readonly: boolean
}

export interface DuplicateMatch {
  id: number; code: string; name: string; level: string; channelId: number; unitId: number
  status: string; owner: string; similarity: number; hitFields: string[]; suggestion: string
}

export interface TransitionField {
  group: string
  subGroup?: string | null
  code: string
  label: string
  required: boolean
  index?: number
  width?: number
  number?: boolean
  ledger?: boolean
  headerBanner?: boolean
  aliases?: string[]
}
export interface TransitionRow {
  id: string; sourceType: string; sourceSheet: string; sourceFile?: string; sourceRow?: number
  code: string; serial?: string; name: string; level: string; channel: string; sourceChannel?: string; projectType?: string
  /** 司局/处室：仅筛选/编辑辅助，不进 Excel 列 */
  orgOffice?: string
  major1: string; major2: string; center?: string; managerUnit?: string; demandUnit: string; responsibleUnit?: string; leadWork: string
  projectStatus?: string; acceptanceStatus?: string; owner?: string; approvalMonth?: string; startMonth?: string; endMonth?: string; duration?: string | number
  totalBudget: number | null; centralGrant: number | null; internalGrant?: number | null; selfFund: number | null; internalSelfFund?: number | null
  spent?: number | null; budget2026?: number | null; budget2026Actual?: number | null; budget2026Rate?: string
  closedActualBudget?: number | null; closedGrantSpent?: number | null; closedSelfSpent?: number | null; closedExecutionRate?: string; executionRate?: string
  resultCount?: number | null; resultNames?: string; convertedCount?: number | null; convertedNames?: string; convertedMonth?: string; convertedModel?: string
  reserveCount?: number | null; reserveNames?: string; reserveYear?: string; remarks?: string
  /** 成果明细（由多行单元格解析，不拆项目行；经费仍按本行统计） */
  resultItems?: {
    resultName: string
    convertedName: string
    convertedMonth: string
    convertedModel: string
  }[]
  color?: 'red' | 'yellow' | 'blue' | 'green'
  transformSummary: string; updatedBy: string; updatedAt: string
  /** 操作人工号（不进 Excel，留痕用） */
  operatorNo?: string
  validation: { ok: boolean; missing: string[]; warnings: string[] }
  /** 当前登录角色对该行是否可写（渠道/单位/类型范围） */
  canWriteRow?: boolean
}
export interface TransitionImportRow {
  id: number
  rowNo: number | null
  identityKey: string
  projectType: string
  projectName: string
  action: 'add' | 'update' | 'keep' | 'delete' | 'skip'
  row: TransitionRow
  validation: { ok: boolean; missing: string[]; warnings: string[] }
  diff: { code: string; field: string; before: string; after: string }[]
  issue: string
}
export interface TransitionImportBatch {
  id: number
  upload_id: number
  file_name: string
  mode: 'merge' | 'replace'
  status: '待确认' | '待修正' | '已入库' | '已取消' | '已撤回' | '处理中'
  uploaded_by: string
  uploaded_at: string
  confirmed_by: string | null
  confirmed_at: string | null
  backup_file?: string | null
  parsed_count: number
  added_count: number
  updated_count: number
  skipped_count: number
  invalid_count: number
  report: {
    imported: number
    added: number
    updated: number
    unchanged?: number
    removed?: number
    skipped: number
    invalid: number
    errors?: { row?: number | string; name?: string; issue: string }[]
  }
  issues: { sheet?: string; row?: number; issue: string }[]
  rows?: TransitionImportRow[]
  canUndo?: boolean
  undoBlockReason?: string
}
export interface TransitionChangeLog {
  id: number
  batchId: number | null
  identityKey: string
  projectType: string
  projectName: string
  action: 'add' | 'update' | 'manual' | 'undo'
  changedBy: string
  changedAt: string
  sourceFile: string
  diff: { code: string; field: string; before: string; after: string }[]
  undone?: number
  undoOf?: number | null
  undoneBy?: string | null
  undoneAt?: string | null
  hasSnapshot?: boolean
  canUndo?: boolean
  undoBlockReason?: string
}
export interface TransitionTemplateRules {
  templateFile: string
  sampleFile: string
  masterSheet: string
  headerRows: number[]
  headerRow: number
  dataStartRow: number
  totalColumns: string
  totalColumnCount: number
  splitField: string
  splitFieldColumn: string
  splitFieldSource: string
  sourceField: string
  sourceFieldColumn: string
  sourceFieldSource: string
  projectTypeCount: number
  sourceChannelCount: number
  validationRules: string[]
}
export interface TransitionTypeOwner {
  projectType: string
  ownerUserId: string
  ownerName: string
  canImport: boolean
  canExport: boolean
  count: number
  totalBudget: number
  invalid: number
  status: string
}
export interface TransitionAccess {
  mode: 'hq' | 'owner' | 'channel' | 'unit' | 'readonly'
  roleKey?: string
  roleLabel?: string
  maintObject?: string
  viewScope?: 'all' | 'unit' | 'self' | 'owned_types' | 'chief'
  canRead?: boolean
  canWrite: boolean
  canImportMaster: boolean
  canConfirm: boolean
  canAssign: boolean
  canExport?: boolean
  canExportAll: boolean
  ownedTypes: string[] | null
  ownedChannels?: string[] | null
  ownedLevels?: string[] | null
  ownedUnitNames?: string[] | null
  label: string
  rights?: { read: string; write: string; export: string }
  v19Note?: string
  visibleFieldGroups?: string[] | null
  /** 登录账号预置工号，前端自动带入留痕 */
  defaultOperatorNo?: string
}
export interface TransitionRoleMatrixRow {
  role: string
  object: string
  read: string
  write: string
  export: string
}
export interface TransitionCascadePath {
  level: string
  sourceChannel: string
  orgOffice: string
  projectType: string
}
export interface TransitionCascade {
  version?: string
  updated?: string
  sourceFile?: string
  levels: string[]
  sourcesByLevel: Record<string, string[]>
  typesByLevel: Record<string, string[]>
  typesByLevelSource: Record<string, Record<string, string[]>>
  /** 层级 → 渠道 → 司局/处室列表（公司级为内部处室） */
  officesByLevelSource?: Record<string, Record<string, string[]>>
  /** 层级 → 渠道 → 司局 → 项目类型 */
  typesByLevelSourceOffice?: Record<string, Record<string, Record<string, string[]>>>
  officeByType?: Record<string, { level: string; source: string; office: string }>
  /** 项目类型 → 唯一路径（双向回填） */
  pathByType?: Record<string, TransitionCascadePath>
  /** 可复现完整路径表 */
  paths?: TransitionCascadePath[]
  major2ByMajor1: Record<string, string[]>
}
export interface TransitionToolData {
  fields: TransitionField[]
  dictionaries: { major1: string[]; major2: string[]; projectTypes: string[]; sourceChannels: string[] }
  cascade?: TransitionCascade
  filterOptions: {
    levels: string[]
    channels: string[]
    offices: string[]
    projectTypes: string[]
    units: string[]
    statuses: string[]
    acceptanceStatuses: string[]
    transformStatuses: string[]
    colors: string[]
  }
  rows: TransitionRow[]
  subtables: { name: string; count: number; totalBudget?: number; invalid?: number }[]
  typeOwners: TransitionTypeOwner[]
  templateRules: TransitionTemplateRules
  summary: { total: number; valid: number; invalid: number; duplicates: string[]; lastUpdated: string | null; totalBudget?: number; centralGrant?: number; selfFund?: number }
  batches: TransitionImportBatch[]
  changeLogs: TransitionChangeLog[]
  access?: TransitionAccess
  roleMatrix?: TransitionRoleMatrixRow[]
  railDesign?: { autoLedger: string[]; formMaintenance: string[] }
  workflow: string[]
  pending?: string[]
}
