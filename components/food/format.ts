// Formatting helpers for the Food module. Kept inside components/food to stay
// within this workstream's scope (no cross-module imports, no shared lib edits).
// Mirrors the date-formatter pattern established in components/mortgage/format.ts.

const dateFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Johannesburg',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-ZA', {
  weekday: 'short',
  timeZone: 'Africa/Johannesburg',
})

const dayMonthFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  timeZone: 'Africa/Johannesburg',
})

/** Format an ISO date string for display in ZA locale, e.g. 26 Jun 2026. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFormatter.format(d)
}

/** Short weekday for a date, e.g. "Fri". */
export function formatWeekday(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return weekdayFormatter.format(d)
}

/** Day + month for a date, e.g. "26 Jun". */
export function formatDayMonth(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return dayMonthFormatter.format(d)
}

/**
 * Human label for a quantity + unit, e.g. "2 kg", "500 g", "3", or "" when
 * neither is present. Used in pantry / grocery / ingredient lists.
 */
export function formatQty(
  qty: number | null | undefined,
  unit: string | null | undefined,
): string {
  const hasQty = typeof qty === 'number' && Number.isFinite(qty)
  const u = unit?.trim() ?? ''
  if (!hasQty && !u) return ''
  if (!hasQty) return u
  // Trim trailing zeros from the numeric portion (numeric(12,3)).
  const n = Number(qty.toFixed(3)).toString()
  return u ? `${n} ${u}` : n
}

/** Days from today (ZA midnight) until `iso`; negative = already past. */
export function daysUntil(iso: string, today = new Date()): number {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY
  const msPerDay = 24 * 60 * 60 * 1000
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const t1 = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((t1 - t0) / msPerDay)
}

/** A short "expiring soon" phrase for a consume-by / expiry date. */
export function expiryLabel(iso: string | null | undefined, today = new Date()): string {
  if (!iso) return ''
  const days = daysUntil(iso, today)
  if (!Number.isFinite(days)) return ''
  if (days < 0) return `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`
  if (days === 0) return 'Use today'
  if (days === 1) return 'Use tomorrow'
  return `${days} days left`
}
