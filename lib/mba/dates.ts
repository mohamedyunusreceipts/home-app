// Date helpers for the MBA module. All "calendar day" maths happens in the
// programme's timezone (SAST), not the server's or the browser's, so a 23:59
// deadline never slips a day when rendered on Vercel (UTC).

export const MBA_TZ = 'Africa/Johannesburg'

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: MBA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** YYYY-MM-DD of `date` in SAST. */
export function dayKey(date: Date): string {
  return dayKeyFmt.format(date)
}

/** Whole SAST calendar days from `now` until `date` (0 = today, -1 = yesterday). */
export function daysUntil(date: Date, now: Date): number {
  const a = Date.parse(`${dayKey(now)}T00:00:00Z`)
  const b = Date.parse(`${dayKey(date)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}
