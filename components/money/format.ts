// Formatting helpers for the Money module. Copied from the mortgage module's
// format helpers (components/mortgage/format.ts) per the module-boundary rule —
// modules do not cross-import. Same ZAR / ZA-locale conventions.

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
 * Format a month (stored as a date, conventionally the 1st of the month, or a
 * 'YYYY-MM' string) as a human month + year, e.g. "June 2026".
 */
export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Accept both 'YYYY-MM' and full ISO dates.
  const normalised = /^\d{4}-\d{2}$/.test(iso) ? `${iso}-01` : iso
  const d = new Date(normalised)
  if (Number.isNaN(d.getTime())) return '—'
  return monthFormatter.format(d)
}

/** Current month as a 'YYYY-MM' string in the app's timezone (Africa/Johannesburg). */
export function currentMonthKey(now: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD; slice to YYYY-MM. Pin to the app timezone.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return ymd.slice(0, 7)
}
