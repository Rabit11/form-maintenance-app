/**
 * 成果转化多行字段：Excel 单单元格多行 → 界面一一对应明细（不拆项目行、不影响经费统计）
 */

export type ResultItem = {
  resultName: string
  convertedName: string
  convertedMonth: string
  convertedModel: string
}

export function splitResultLines(value: unknown): string[] {
  const text = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
  if (!text) return []

  const byNewline = text.split('\n').map((x) => x.trim()).filter(Boolean)
  if (byNewline.length > 1) return byNewline

  const only = byNewline[0] || text
  if (/[；;、]/.test(only)) {
    return only.split(/[；;、]+/).map((x) => x.trim()).filter(Boolean)
  }
  return [only]
}

export function joinResultLines(lines: string[]): string {
  return (lines || [])
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

export function pairResultItems(row: {
  resultNames?: string | null
  convertedNames?: string | null
  convertedMonth?: string | null
  convertedModel?: string | null
  resultCount?: number | null
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
    Number(row.resultCount) > 0 && resultNames.length === 0 ? Number(row.resultCount) : 0,
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
