// Display formatting for the MBA screens, pinned to SAST so server and client
// render identical strings.

import { MBA_TZ, daysUntil } from './dates'

const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: MBA_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const longDayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: MBA_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: MBA_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "Tue 20 Oct" */
export const fmtDay = (iso: string) => dayFmt.format(new Date(iso))
/** "Tuesday 20 October 2026" */
export const fmtLongDay = (iso: string) => longDayFmt.format(new Date(iso))
/** "19:00" */
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso))

/** "today" / "tomorrow" / "in 3 days" / "yesterday" / "4 days ago" */
export function relativeDays(iso: string, now: Date): string {
  const d = daysUntil(new Date(iso), now)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  return d > 0 ? `in ${d} days` : `${-d} days ago`
}

/** Urgency bucket for a due date, used to colour countdown pills. */
export function urgency(iso: string, now: Date, done: boolean): 'done' | 'overdue' | 'urgent' | 'soon' | 'later' {
  if (done) return 'done'
  if (new Date(iso) < now) return 'overdue'
  const d = daysUntil(new Date(iso), now)
  if (d <= 2) return 'urgent'
  if (d <= 7) return 'soon'
  return 'later'
}
