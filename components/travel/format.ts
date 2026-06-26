// Formatting helpers for the travel module. Copied into components/travel to
// stay within the module's scope (no cross-module imports, no shared lib changes).

const zarFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
})

const zarNoDecimalsFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Johannesburg',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-ZA', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  timeZone: 'Africa/Johannesburg',
})

/** Format a number as ZAR currency, e.g. R1 234,56. */
export function formatZar(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return zarFormatter.format(value)
}

/** Format a number as ZAR currency without cents — for big headline figures. */
export function formatZarRounded(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return zarNoDecimalsFormatter.format(value)
}

/** Format an ISO date string for display in ZA locale, e.g. 26 Jun 2026. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFormatter.format(d)
}

/** Format an ISO date as a short weekday + date, e.g. "Fri, 26 Jun". */
export function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return weekdayFormatter.format(d)
}
