/** 金额（万元）→ 展示字符串 */
export function wan(x: number | null | undefined, digits = 0): string {
  if (x == null) return '—'
  return x.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

/** 万元 → 亿元字符串 */
export function yi(wanVal: number | null | undefined, digits = 2): string {
  if (wanVal == null) return '—'
  return (wanVal / 10000).toFixed(digits)
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.slice(0, 10).replace(/-/g, '.')
}

export function pct(x: number | null | undefined): string {
  if (x == null) return '—'
  return `${Math.round(x)}%`
}

/** 剩余天数文案 */
export function daysText(days: number | null | undefined): string {
  if (days == null) return ''
  if (days < 0) return `超期 ${-days} 天`
  if (days === 0) return '今日到期'
  return `剩余 ${days} 天`
}
