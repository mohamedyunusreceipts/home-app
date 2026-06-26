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

// ── Focus Timeline week strip + agenda grouping ──────────────────────────────

const TODAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const DOW_SHORT = new Intl.DateTimeFormat('en-ZA', {
  timeZone: TZ,
  weekday: 'short',
})

/** Today's local 'YYYY-MM-DD' key (app timezone). */
export function todayKey(now: Date = new Date()): string {
  return TODAY_FMT.format(now)
}

/** "JUNE 2026" — uppercase month+year for the agenda header. */
export function monthLabelUpper(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]!.toUpperCase()} ${year}`
}

export interface WeekStripDay {
  /** 'YYYY-MM-DD' key. */
  key: string
  /** Day-of-month number (1–31). */
  day: number
  /** Single-letter weekday header (M T W T F S S). */
  weekdayLetter: string
  /** True when this is today (app timezone). */
  isToday: boolean
  /** True when any (filtered) event falls on this day. */
  hasEvents: boolean
  /** True when a special event (birthday) falls on this day. */
  special: boolean
}

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * The Monday–Sunday week containing `todayKey`, as 7 day cells. `byDay` buckets
 * (from bucketByDay) drive the per-day event dot; a birthday on a day marks it
 * special (terracotta dot) rather than normal (sage).
 */
export function buildWeekStrip(
  byDay: Map<string, CalendarEventRow[]>,
  today: string = todayKey(),
): WeekStripDay[] {
  const [ty, tm, td] = today.split('-').map(Number)
  const base = new Date(Date.UTC(ty!, tm! - 1, td!))
  // Monday-start offset: JS getUTCDay 0=Sun..6=Sat → Mon=0..Sun=6.
  const offset = (base.getUTCDay() + 6) % 7
  const monday = new Date(base)
  monday.setUTCDate(base.getUTCDate() - offset)

  const cells: WeekStripDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const key = `${y}-${m}-${dd}`
    const events = byDay.get(key) ?? []
    cells.push({
      key,
      day: d.getUTCDate(),
      weekdayLetter: WEEKDAY_LETTERS[i]!,
      isToday: key === today,
      hasEvents: events.length > 0,
      special: events.some((e) => e.category === 'birthdays'),
    })
  }
  return cells
}

export interface AgendaDay {
  /** 'YYYY-MM-DD' key. */
  key: string
  /** Header label, e.g. "TUE 26". */
  label: string
  /** Short title-case weekday, e.g. "Wed" — used as a row prefix. */
  dow: string
  /** Events on this day, time-sorted (all-day first). */
  events: CalendarEventRow[]
}

/** "TUE 26" header for a day key (uppercase short weekday + day-of-month). */
function agendaDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  return `${DOW_SHORT.format(date).toUpperCase()} ${d}`
}

/** "Wed" — short title-case weekday for a day key. */
function dowOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d!))
  return DOW_SHORT.format(date)
}

/** Minutes-since-midnight (app timezone) for an ISO timestamp; all-day → -1. */
function startMinutes(row: CalendarEventRow): number {
  if (row.all_day) return -1
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(row.start))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

/** "HH:MM" start label (app timezone). */
export function timeLabelOf(row: CalendarEventRow): string {
  if (row.all_day) return 'All day'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(row.start))
}

/**
 * Group buckets into agenda days from `today` through the end of today's
 * Mon–Sun week (inclusive). Empty days are dropped. The first returned day is
 * today (even if it has no events, so the agenda can show "TODAY ·" with an
 * empty state). Each day's events are time-sorted, all-day first.
 */
export function buildAgenda(
  byDay: Map<string, CalendarEventRow[]>,
  today: string = todayKey(),
): AgendaDay[] {
  const [ty, tm, td] = today.split('-').map(Number)
  const base = new Date(Date.UTC(ty!, tm! - 1, td!))
  const offset = (base.getUTCDay() + 6) % 7
  const daysLeftInWeek = 6 - offset // through Sunday

  const out: AgendaDay[] = []
  for (let i = 0; i <= daysLeftInWeek; i++) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const key = `${y}-${m}-${dd}`
    const events = (byDay.get(key) ?? [])
      .slice()
      .sort((a, b) => startMinutes(a) - startMinutes(b))
    if (i === 0 || events.length > 0) {
      out.push({ key, label: agendaDayLabel(key), dow: dowOf(key), events })
    }
  }
  return out
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
