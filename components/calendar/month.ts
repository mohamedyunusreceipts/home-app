// Pure helpers for building a dependency-free month grid and bucketing calendar
// rows into day cells. The app's locale is Africa/Johannesburg (UTC+2, no DST);
// we work in local-date keys ('YYYY-MM-DD') derived in that timezone so an
// all-day event lands on the intended calendar day regardless of host timezone.

import type { CalendarEventRow } from './types'

const TZ = 'Africa/Johannesburg'

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** A 'YYYY-MM-DD' key for a Date, evaluated in the app's timezone. */
export function dayKey(date: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return dayKeyFormatter.format(date)
}

/** Day key for an ISO timestamp string. */
export function dayKeyOf(iso: string): string {
  return dayKey(new Date(iso))
}

export interface MonthGridDay {
  /** 'YYYY-MM-DD' key. */
  key: string
  /** Day-of-month number (1–31). */
  day: number
  /** True when the day belongs to the displayed month (not a leading/trailing pad). */
  inMonth: boolean
  /** True when the day is today (in the app timezone). */
  isToday: boolean
}

/**
 * Build a 6-row × 7-col (42-cell) month grid for the given year/month (month is
 * 1-based). Weeks start on Monday. Leading/trailing cells pad to a full grid.
 */
export function buildMonthGrid(year: number, month: number): MonthGridDay[] {
  const todayKey = dayKey(new Date())
  const cells: MonthGridDay[] = []

  // First of the month (UTC date math — date-only, no timezone ambiguity here).
  const first = new Date(Date.UTC(year, month - 1, 1))
  // JS getUTCDay: 0=Sun..6=Sat. We want Monday-start: Mon=0..Sun=6.
  const firstWeekday = (first.getUTCDay() + 6) % 7

  // Start date = first-of-month minus the lead-in days.
  const start = new Date(first)
  start.setUTCDate(first.getUTCDate() - firstWeekday)

  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const dayNum = d.getUTCDate()
    const key = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    cells.push({
      key,
      day: dayNum,
      inMonth: m === month && y === year,
      isToday: key === todayKey,
    })
  }

  return cells
}

/**
 * Bucket calendar rows by day key. A multi-day all-day span (e.g. a trip) is
 * placed on every day it covers, using the view's exclusive `end` for all-day
 * rows (so a trip ending 2026-08-07 spans through the 7th, end-key 2026-08-08).
 */
export function bucketByDay(
  rows: CalendarEventRow[],
): Map<string, CalendarEventRow[]> {
  const map = new Map<string, CalendarEventRow[]>()
  const add = (key: string, row: CalendarEventRow) => {
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }

  for (const row of rows) {
    const startKey = dayKeyOf(row.start)
    if (!row.all_day || !row.end) {
      add(startKey, row)
      continue
    }
    // Multi-day all-day span: iterate from start to (exclusive) end.
    const endKey = dayKeyOf(row.end)
    if (endKey <= startKey) {
      add(startKey, row)
      continue
    }
    // Walk day-by-day using UTC date arithmetic on the start's wall date.
    const [sy, sm, sd] = startKey.split('-').map(Number)
    const cursor = new Date(Date.UTC(sy!, sm! - 1, sd!))
    for (let guard = 0; guard < 366; guard++) {
      const y = cursor.getUTCFullYear()
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(cursor.getUTCDate()).padStart(2, '0')
      const key = `${y}-${m}-${dd}`
      if (key >= endKey) break // end is exclusive for all-day spans
      add(key, row)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }

  return map
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "June 2026" label for a 1-based month. */
export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** Step a 1-based {year, month} by ±1 month, rolling the year over. */
export function stepMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zeroBased = month - 1 + delta
  const newYear = year + Math.floor(zeroBased / 12)
  const newMonth = ((zeroBased % 12) + 12) % 12
  return { year: newYear, month: newMonth + 1 }
}
