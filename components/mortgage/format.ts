// Formatting helpers for the mortgage module. Kept inside components/mortgage
// to stay within the UI workstream's scope (no shared lib changes).

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

const monthFormatter = new Intl.DateTimeFormat('en-ZA', {
  month: 'long',
  year: 'numeric',
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

/**
 * Format a statement month (stored as a date, conventionally the 1st of the
 * month) as a human month + year, e.g. "June 2026".
 */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return monthFormatter.format(d)
}

/** Format a percentage rate, e.g. 11.25 -> "11,25%". */
export function formatRate(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`
}
