// Expand recurring iCal events (RRULE + EXDATE + RECURRENCE-ID overrides) into
// concrete occurrences inside a window.
//
// rrule computes in UTC, so occurrences are generated on a "fake UTC" timeline
// that carries the event's local wall-clock time, then each one is converted
// back with the event's zone. A weekly 19:00 meeting therefore stays at 19:00
// local across DST changes instead of drifting by an hour.

import { RRule } from 'rrule'
import { tzOffsetMs, zonedToUtc, type IcalEvent } from './ical'

export interface Occurrence {
  /** Unique per occurrence: the UID, suffixed with the start for series. */
  uid: string
  summary: string
  description: string
  location: string
  url: string
  start: Date
  end: Date | null
  allDay: boolean
}

const MAX_PER_SERIES = 500
const MINUTE = 60_000

const toFake = (d: Date, tz: string) => d.getTime() + tzOffsetMs(d.getTime(), tz)

function fromFake(fakeMs: number, tz: string): Date {
  const f = new Date(fakeMs)
  return zonedToUtc(
    f.getUTCFullYear(),
    f.getUTCMonth() + 1,
    f.getUTCDate(),
    f.getUTCHours(),
    f.getUTCMinutes(),
    f.getUTCSeconds(),
    tz,
  )
}

const sameInstant = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) < MINUTE

function toOccurrence(ev: IcalEvent, uid: string, start: Date, end: Date | null): Occurrence {
  return {
    uid,
    summary: ev.summary,
    description: ev.description,
    location: ev.location,
    url: ev.url,
    start,
    end,
    allDay: ev.allDay,
  }
}

export function expandEvents(events: IcalEvent[], from: Date, to: Date): Occurrence[] {
  const inWindow = (d: Date) => d >= from && d <= to

  // Instances replaced by a RECURRENCE-ID override, keyed by series UID.
  const overridden = new Map<string, Date[]>()
  for (const ev of events) {
    if (ev.recurrenceId) {
      overridden.set(ev.uid, [...(overridden.get(ev.uid) ?? []), ev.recurrenceId])
    }
  }

  const out: Occurrence[] = []
  for (const ev of events) {
    if (ev.cancelled) continue
    const durationMs = ev.end ? ev.end.getTime() - ev.start.getTime() : null

    if (ev.recurrenceId) {
      if (inWindow(ev.start)) {
        out.push(toOccurrence(ev, `${ev.uid}::${ev.recurrenceId.toISOString()}`, ev.start, ev.end))
      }
      continue
    }

    if (!ev.rrule) {
      if (inWindow(ev.start)) out.push(toOccurrence(ev, ev.uid, ev.start, ev.end))
      continue
    }

    let rule: RRule
    try {
      const options = RRule.parseString(ev.rrule)
      if (options.until) options.until = new Date(toFake(options.until, ev.tz))
      rule = new RRule({ ...options, dtstart: new Date(toFake(ev.start, ev.tz)) })
    } catch {
      // Unparseable rule: fall back to the first instance only.
      if (inWindow(ev.start)) out.push(toOccurrence(ev, ev.uid, ev.start, ev.end))
      continue
    }

    const skip = [...ev.exdates, ...(overridden.get(ev.uid) ?? [])]
    const fakeFrom = new Date(toFake(from, ev.tz) - 2 * 86_400_000)
    const fakeTo = new Date(toFake(to, ev.tz) + 2 * 86_400_000)
    let n = 0
    rule.between(fakeFrom, fakeTo, true, () => n++ < MAX_PER_SERIES).forEach((fake) => {
      const start = fromFake(fake.getTime(), ev.tz)
      if (!inWindow(start) || skip.some((x) => sameInstant(x, start))) return
      const end = durationMs === null ? null : new Date(start.getTime() + durationMs)
      out.push(toOccurrence(ev, `${ev.uid}::${start.toISOString()}`, start, end))
    })
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}
