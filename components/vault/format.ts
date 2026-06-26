// Formatting helpers for the Vault module. Copied (not imported) from the
// mortgage module to respect the spec's module-boundary rule (§3.2): modules
// must not import from each other.

const zarFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
})

const dateFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Johannesburg',
})

/** Format a number as ZAR currency, e.g. R1 234,56. */
export function formatZar(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return zarFormatter.format(value)
}

/** Format an ISO date string for display in ZA locale, e.g. 26 Jun 2026. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFormatter.format(d)
}

/**
 * Whole days from today (Africa/Johannesburg) until the given ISO date.
 * Negative when the date is in the past, null for missing/invalid input.
 */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  // Compare calendar days, not wall-clock instants.
  const startOfDay = (x: Date) =>
    Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  const diffMs = startOfDay(d) - startOfDay(today)
  return Math.round(diffMs / 86_400_000)
}

/** A short human label for an upcoming/past expiry, e.g. "in 12 days", "expired". */
export function expiryLabel(iso: string | null | undefined): string {
  const days = daysUntil(iso)
  if (days == null) return ''
  if (days < 0) return 'expired'
  if (days === 0) return 'expires today'
  if (days === 1) return 'in 1 day'
  return `in ${days} days`
}
