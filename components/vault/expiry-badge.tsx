import { daysUntil, expiryLabel } from './format'

/**
 * A small coloured pill showing how soon something expires.
 * Red when overdue, terracotta within the 60-day reminder window (spec §9.7),
 * muted sage otherwise. Renders nothing when there is no date.
 */
export function ExpiryBadge({ date }: { date: string | null | undefined }) {
  const days = daysUntil(date)
  if (days == null) return null

  const label = expiryLabel(date)
  let cls = 'bg-sage-100 text-sage-700'
  if (days < 0) cls = 'bg-red-100 text-red-700'
  else if (days <= 60) cls = 'bg-terracotta-100 text-terracotta-700'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  )
}
