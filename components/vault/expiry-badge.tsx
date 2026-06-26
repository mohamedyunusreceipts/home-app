import { daysUntil } from './format'

/**
 * Focus Timeline expiry pill — a two-line "N / days" badge used by the Vault
 * "Coming up" list. Amber (terracotta-600 on terracotta-50/100 ring) when the
 * date is near (≤~30 days or already overdue); sage otherwise. Renders nothing
 * when there is no date.
 *
 * Per handoff §8: amber #974F38 on #FBF2EE / #F4DDD2 ring when ≤~30 days,
 * sage #5F8160 on #F1F5F1 / #DCE7DC ring otherwise.
 */
export function ExpiryBadge({ date }: { date: string | null | undefined }) {
  const days = daysUntil(date)
  if (days == null) return null

  const near = days <= 30
  const palette = near
    ? { fg: '#974F38', bg: '#FBF2EE', ring: '#F4DDD2' }
    : { fg: '#5F8160', bg: '#F1F5F1', ring: '#DCE7DC' }

  // Overdue collapses to a compact label; otherwise show the day count.
  const overdue = days < 0
  const top = overdue ? 'past' : days === 0 ? 'today' : String(days)
  const bottom = overdue ? 'due' : days === 0 ? '' : days === 1 ? 'day' : 'days'

  return (
    <span
      className="inline-flex shrink-0 flex-col items-center justify-center rounded-full px-2.5 py-1 text-center leading-none"
      style={{
        color: palette.fg,
        background: palette.bg,
        border: `1px solid ${palette.ring}`,
        minWidth: 46,
      }}
    >
      <span className="text-[13px] font-semibold">{top}</span>
      {bottom && <span className="text-[10px] font-medium">{bottom}</span>}
    </span>
  )
}
