/**
 * 成果转化多行字段：Excel 单单元格多行 → 界面一一对应明细（不拆项目行、不影响经费统计）
 */

export type ResultItem = {
  resultName: string
  convertedName: string
  convertedMonth: string
  convertedModel: string
}

function cleanResultPart(value: unknown): string {
  const text = String(value ?? '')
    .trim()
    .replace(/^[，,;；、]+/, '')
    .replace(/[，,;；、]+$/, '')
    .trim()
  if (!text || /^(?:\/|／|—|–|−|-|－|N\/A|n\/a|NA|na|无|空)$/.test(text)) return ''
  return text
}

function looksLikeTokenList(parts: string[]): boolean {
  if (parts.length < 2) return false
  return parts.every((part) => (
    /^\d{4}\.\d{1,2}$/.test(part)
    || /^\d{4}$/.test(part)
    || /^[A-Za-z][A-Za-z0-9_-]{0,24}$/.test(part)
  ))
}

export function splitResultLines(value: unknown): string[] {
  const text = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
  if (!text) return []

  const byNewline = text.split('\n').map(cleanResultPart).filter(Boolean)
  if (byNewline.length > 1) return byNewline

  const only = byNewline[0] || cleanResultPart(text)
  if (!only) return []

  if (/[；;、，]/.test(only)) {
    const parts = only.split(/[；;、，]+/).map(cleanResultPart).filter(Boolean)
    if (parts.length > 1) return parts
  }

  if (only.includes(',')) {
    const parts = only.split(/,\s*/).map(cleanResultPart).filter(Boolean)
    if (looksLikeTokenList(parts)) return parts
  }

  return [only]
}

export function joinResultLines(lines: string[]): string {
  return (lines || [])
    .map((x) => cleanResultPart(x))
    .filter(Boolean)
    .join('\n')
}

export function pairResultItems(row: {
  resultNames?: string | null
  convertedNames?: string | null
  convertedMonth?: string | null
  convertedModel?: string | null
} = {}): ResultItem[] {
  const resultNames = splitResultLines(row.resultNames)
  const convertedNames = splitResultLines(row.convertedNames)
  const convertedMonths = splitResultLines(row.convertedMonth)
  const convertedModels = splitResultLines(row.convertedModel)
  const count = Math.max(
    resultNames.length,
    convertedNames.length,
    convertedMonths.length,
    convertedModels.length,
  )
  if (count <= 0) return []

  const items: ResultItem[] = []
  for (let i = 0; i < count; i += 1) {
    items.push({
      resultName: resultNames[i] || '',
      convertedName: convertedNames[i] || '',
      convertedMonth: convertedMonths[i] || '',
      convertedModel: convertedModels[i] || '',
    })
  }
  return items
}

export function serializeResultItems(items: ResultItem[] = []) {
  const list = Array.isArray(items) ? items : []
  return {
    resultNames: joinResultLines(list.map((x) => x.resultName)),
    convertedNames: joinResultLines(list.map((x) => x.convertedName)),
    convertedMonth: joinResultLines(list.map((x) => x.convertedMonth)),
    convertedModel: joinResultLines(list.map((x) => x.convertedModel)),
    resultCount: list.filter((x) => String(x.resultName || '').trim()).length || null,
    convertedCount: list.filter((x) => String(x.convertedName || '').trim()).length || null,
  }
}

export function normalizeResultFields(row: Record<string, unknown> = {}) {
  const hasContent = ['resultNames', 'convertedNames', 'convertedMonth', 'convertedModel']
    .some((key) => String(row[key] ?? '').trim())
  if (!hasContent) return {}

  const items = pairResultItems(row)
  if (!items.length) return {}

  const packed: Record<string, unknown> = { ...serializeResultItems(items) }
  const excelResultCount = Number.isFinite(Number(row.resultCount)) ? Number(row.resultCount) : null
  const excelConvertedCount = Number.isFinite(Number(row.convertedCount)) ? Number(row.convertedCount) : null
  if (excelResultCount != null) packed.resultCount = excelResultCount
  if (excelConvertedCount != null) packed.convertedCount = excelConvertedCount
  const reserveNames = splitResultLines(row.reserveNames)
  const reserveYears = splitResultLines(row.reserveYear)
  if (reserveNames.length > 1 || /[；;、，\n]/.test(String(row.reserveNames ?? ''))) {
    packed.reserveNames = joinResultLines(reserveNames)
    if (reserveNames.length) packed.reserveCount = reserveNames.length
  }
  if (reserveYears.length > 1 || /[；;、，\n,]/.test(String(row.reserveYear ?? ''))) {
    packed.reserveYear = joinResultLines(reserveYears)
  }
  return packed
}

export function resultItemsPreview(items: ResultItem[], max = 2) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return { text: '—', extra: 0 }
  const names = list.map((x) => x.resultName || x.convertedName).filter(Boolean)
  if (!names.length) return { text: `共 ${list.length} 条成果明细`, extra: 0 }
  const head = names.slice(0, max).join('；')
  const extra = Math.max(0, names.length - max)
  return { text: extra ? `${head} …+${extra}` : head, extra }
}

export const RESULT_FIELD_CODES = new Set([
  'resultNames',
  'convertedNames',
  'convertedMonth',
  'convertedModel',
  'resultCount',
  'convertedCount',
])
