// Minimal, dependency-free iCalendar (RFC 5545) VEVENT reader — just enough for
// an LMS calendar-subscription feed (Brightspace/D2L and similar).
//
// Handles: line unfolding, quoted parameters, TEXT unescaping, UTC ("Z"),
// TZID-local (IANA or common Windows names) and all-day (VALUE=DATE) values.
// Recurrence data (RRULE / EXDATE / RECURRENCE-ID) is captured raw here and
// expanded by ./recurrence — mailbox calendars use it for weekly meetings.

import { MBA_TZ } from './dates'

export interface IcalEvent {
  uid: string
  summary: string
  description: string
  location: string
  url: string
  start: Date
  end: Date | null
  /** All-day events are pinned to 23:59 local on that day (a deadline). */
  allDay: boolean
  /** Zone the start's wall-clock time is expressed in (for recurrence maths). */
  tz: string
  /** Raw RRULE value, e.g. "FREQ=WEEKLY;BYDAY=TU", or null. */
  rrule: string | null
  /** Excluded occurrence starts. */
  exdates: Date[]
  /** Set on an override of one occurrence of a recurring series. */
  recurrenceId: Date | null
  cancelled: boolean
}

/** Windows zone ids some LMS exports use instead of IANA names. */
const WINDOWS_TZ: Record<string, string> = {
  'South Africa Standard Time': 'Africa/Johannesburg',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Eastern Standard Time': 'America/New_York',
  'Pacific Standard Time': 'America/Los_Angeles',
  UTC: 'UTC',
}

function resolveTz(name: string | undefined, fallback: string): string {
  if (!name) return fallback
  const tz = WINDOWS_TZ[name] ?? name
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return fallback
  }
}

/** Offset (ms) of `tz` from UTC at the instant `utcMs`. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/** The UTC instant of a wall-clock time in `tz` (month is 1-based). */
export function zonedToUtc(
  y: number,
  month: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, month - 1, d, h, mi, s)
  const off1 = tzOffsetMs(guess, tz)
  let t = guess - off1
  // Re-check once: the offset can differ either side of a DST transition.
  const off2 = tzOffsetMs(t, tz)
  if (off2 !== off1) t = guess - off2
  return new Date(t)
}

/** Split on `sep` outside double quotes. */
function splitOutsideQuotes(s: string, sep: string): string[] {
  const out: string[] = []
  let inQuotes = false
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '"') inQuotes = !inQuotes
    else if (c === sep && !inQuotes) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out
}

interface Prop {
  name: string
  params: Record<string, string>
  value: string
}

function parseLine(line: string): Prop | null {
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQuotes = !inQuotes
    else if (c === ':' && !inQuotes) {
      const [name = '', ...rawParams] = splitOutsideQuotes(line.slice(0, i), ';')
      const params: Record<string, string> = {}
      for (const p of rawParams) {
        const eq = p.indexOf('=')
        if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
      }
      return { name: name.toUpperCase(), params, value: line.slice(i + 1) }
    }
  }
  return null
}

function unescapeText(v: string): string {
  return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))
}

interface ParsedDate {
  date: Date
  allDay: boolean
  tz: string
}

function parseDateValue(
  value: string,
  params: Record<string, string>,
  defaultTz: string,
): ParsedDate | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  const Y = Number(y)
  const M = Number(mo)
  const D = Number(d)
  if (params.VALUE === 'DATE' || h === undefined) {
    return { date: zonedToUtc(Y, M, D, 23, 59, 0, defaultTz), allDay: true, tz: defaultTz }
  }
  if (z) {
    return {
      date: new Date(Date.UTC(Y, M - 1, D, Number(h), Number(mi), Number(s))),
      allDay: false,
      tz: 'UTC',
    }
  }
  const tz = resolveTz(params.TZID, defaultTz)
  return { date: zonedToUtc(Y, M, D, Number(h), Number(mi), Number(s), tz), allDay: false, tz }
}

function parseDate(prop: Prop, defaultTz: string): ParsedDate | null {
  return parseDateValue(prop.value, prop.params, defaultTz)
}

/** Parse every usable VEVENT (one with a UID and a start) from a feed. */
export function parseICal(text: string, opts: { defaultTz?: string } = {}): IcalEvent[] {
  const defaultTz = opts.defaultTz ?? MBA_TZ
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')

  const events: IcalEvent[] = []
  let cur: Prop[] | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = []
    } else if (line === 'END:VEVENT') {
      if (cur) {
        const ev = buildEvent(cur, defaultTz)
        if (ev) events.push(ev)
      }
      cur = null
    } else if (cur) {
      const p = parseLine(line)
      if (p) cur.push(p)
    }
  }
  return events
}

function buildEvent(props: Prop[], defaultTz: string): IcalEvent | null {
  const get = (n: string) => props.find((p) => p.name === n)
  const uid = get('UID')?.value.trim()
  const dtStart = get('DTSTART')
  if (!uid || !dtStart) return null
  const start = parseDate(dtStart, defaultTz)
  if (!start) return null
  const dtEnd = get('DTEND')
  const end = dtEnd ? parseDate(dtEnd, defaultTz) : null

  // EXDATE may repeat and/or hold comma-separated values.
  const exdates = props
    .filter((p) => p.name === 'EXDATE')
    .flatMap((p) => p.value.split(',').map((v) => parseDateValue(v, p.params, defaultTz)))
    .filter((d): d is ParsedDate => d !== null)
    .map((d) => d.date)
  const recurrenceIdProp = get('RECURRENCE-ID')

  const text = (n: string) => unescapeText(get(n)?.value ?? '').trim()
  return {
    uid,
    summary: text('SUMMARY'),
    description: text('DESCRIPTION'),
    location: text('LOCATION'),
    url: (get('URL')?.value ?? '').trim(),
    start: start.date,
    end: end?.date ?? null,
    allDay: start.allDay,
    tz: start.tz,
    rrule: get('RRULE')?.value.trim() || null,
    exdates,
    recurrenceId: recurrenceIdProp ? (parseDate(recurrenceIdProp, defaultTz)?.date ?? null) : null,
    cancelled: (get('STATUS')?.value.trim().toUpperCase() ?? '') === 'CANCELLED',
  }
}
