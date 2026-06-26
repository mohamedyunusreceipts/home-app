// Formatting helpers for the Home Management module. Kept inside
// components/home to stay within the module's scope (no cross-module imports,
// per the module-boundary rule in design spec §3.2). Mirrors the pattern in
// components/mortgage/format.ts.

const dateFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Johannesburg',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Africa/Johannesburg',
})

const zarFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
})

/** Format an ISO date (date-only or timestamp) for display, e.g. 26 Jun 2026. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFormatter.format(d)
}

/** Format an ISO timestamp with time, e.g. 26 Jun 2026, 14:30. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateTimeFormatter.format(d)
}

/** Format a number as ZAR currency without cents, e.g. R12 000. */
export function formatZar(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return zarFormatter.format(value)
}

const STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  planning: 'Planning',
  in_progress: 'In progress',
  done: 'Done',
}

/** Human label for a home_projects.status value. */
export function formatProjectStatus(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status
}

/**
 * Relative due-date helper for the tick-off lists. Returns a short phrase like
 * "Overdue", "Due today", "Due tomorrow", or the formatted date. Compares dates
 * at day granularity in the app's timezone is approximated via local Date math
 * (next_due is a date-only column).
 */
export function describeDue(nextDue: string | null | undefined, now: Date = new Date()): string {
  if (!nextDue) return 'No due date'
  const due = new Date(`${nextDue.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(due.getTime())) return '—'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due ${formatDate(nextDue)}`
}
