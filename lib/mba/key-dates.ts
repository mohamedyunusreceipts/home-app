// Programme key dates (blocks, breaks, milestones): pure helpers over
// YYYY-MM-DD strings, which compare correctly as plain strings.

export type KeyDateKind = 'in_person' | 'hybrid' | 'online' | 'break' | 'optional' | 'milestone'

export interface KeyDate {
  id: string
  title: string
  kind: KeyDateKind
  startDate: string
  endDate: string | null
  leaveDays: number | null
  year: number | null
  notes: string | null
}

const end = (k: KeyDate) => k.endDate ?? k.startDate

/** Kinds that need you on campus (or may): the ones leave is planned around. */
export const ATTENDANCE_KINDS: KeyDateKind[] = ['in_person', 'hybrid']

/** Not yet over on `today` (in progress or upcoming), in start order. */
export function currentAndUpcoming(dates: KeyDate[], today: string): KeyDate[] {
  return dates.filter((k) => end(k) >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** The next (or in-progress) in-person/hybrid block. */
export function nextAttendanceBlock(dates: KeyDate[], today: string): KeyDate | undefined {
  return currentAndUpcoming(dates, today).find((k) => ATTENDANCE_KINDS.includes(k.kind))
}

/** Key dates that overlap the inclusive range [from, to]. */
export function overlapping(dates: KeyDate[], from: string, to: string): KeyDate[] {
  return dates.filter((k) => k.startDate <= to && end(k) >= from)
}

export interface LeaveYear {
  year: number
  total: number
  /** Leave still to be taken: blocks that haven't started by `today`. */
  remaining: number
}

/** Leave days per programme year, and how many are still ahead. */
export function leaveByYear(dates: KeyDate[], today: string): LeaveYear[] {
  const years = new Map<number, LeaveYear>()
  for (const k of dates) {
    if (k.year == null || !k.leaveDays) continue
    const y = years.get(k.year) ?? { year: k.year, total: 0, remaining: 0 }
    y.total += k.leaveDays
    if (k.startDate > today) y.remaining += k.leaveDays
    years.set(k.year, y)
  }
  return [...years.values()].sort((a, b) => a.year - b.year)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parts(d: string) {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number]
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]!
  return { y, m, day, wd, mon: MONTHS[m - 1]! }
}

/** "Wed 3 Feb" */
export function formatShort(d: string): string {
  const p = parts(d)
  return `${p.wd} ${p.day} ${p.mon}`
}

/** Compact status for a date range as seen from `today`: "until Wed 3 Feb" / "starts Wed 3 Feb". */
export function rangeStatus(k: Pick<KeyDate, 'startDate' | 'endDate'>, today: string): string {
  return k.startDate <= today
    ? `until ${formatShort(k.endDate ?? k.startDate)}`
    : `starts ${formatShort(k.startDate)}`
}

/**
 * "Wed 3 – Sun 7 Feb 2027", "30 Jun – 18 Jul 2027", "14 Dec 2026 – 3 Feb 2027",
 * or a single day "Sun 6 Dec 2027". Weekdays are shown for short ranges only.
 */
export function formatRange(start: string, endDate: string | null): string {
  const a = parts(start)
  if (!endDate || endDate === start) return `${a.wd} ${a.day} ${a.mon} ${a.y}`
  const b = parts(endDate)
  const days = (Date.UTC(b.y, b.m - 1, b.day) - Date.UTC(a.y, a.m - 1, a.day)) / 86_400_000
  const wd = (p: typeof a) => (days <= 7 ? `${p.wd} ` : '')
  if (a.y !== b.y) return `${wd(a)}${a.day} ${a.mon} ${a.y} – ${wd(b)}${b.day} ${b.mon} ${b.y}`
  if (a.m !== b.m) return `${wd(a)}${a.day} ${a.mon} – ${wd(b)}${b.day} ${b.mon} ${b.y}`
  return `${wd(a)}${a.day} – ${wd(b)}${b.day} ${b.mon} ${b.y}`
}
