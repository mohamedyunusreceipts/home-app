import { describe, it, expect } from 'vitest'
import {
  nextOccurrence,
  occurrencesBetween,
  describeRrule,
  isValidRrule,
  buildRrule,
} from '@/lib/rrule'

// All dates are UTC (see module docs). Use Date.UTC throughout so the tests are
// independent of the host machine's timezone.
const utc = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(Date.UTC(y, m, d, h, min))

describe('nextOccurrence', () => {
  it('daily rule: returns the next day strictly after `after`', () => {
    // DTSTART anchors the series; daily from 2026-01-01.
    const rule = 'DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY'
    const next = nextOccurrence(rule, utc(2026, 0, 1, 9, 0))
    expect(next).not.toBeNull()
    // strictly after → 2026-01-02 09:00Z, not the same instant.
    expect(next?.toISOString()).toBe('2026-01-02T09:00:00.000Z')
  })

  it('weekly rule on Monday: returns the next matching Monday', () => {
    // 2026-06-26 is a Friday. Next Monday is 2026-06-29.
    const rule = 'RRULE:FREQ=WEEKLY;BYDAY=MO'
    const next = nextOccurrence(rule, utc(2026, 5, 26))
    expect(next).not.toBeNull()
    expect(next?.getUTCDay()).toBe(1) // Monday
    expect(next?.toISOString().slice(0, 10)).toBe('2026-06-29')
  })

  it('monthly rule: returns the next month occurrence', () => {
    const rule = 'DTSTART:20260115T000000Z\nRRULE:FREQ=MONTHLY'
    const next = nextOccurrence(rule, utc(2026, 0, 15))
    expect(next?.toISOString().slice(0, 10)).toBe('2026-02-15')
  })

  it('defaults `after` to now and still returns a future date for an open rule', () => {
    const before = Date.now()
    const next = nextOccurrence('RRULE:FREQ=DAILY')
    expect(next).not.toBeNull()
    expect(next!.getTime()).toBeGreaterThan(before)
  })

  it('returns null when a COUNT-bounded rule is exhausted', () => {
    // Only 3 occurrences: 2026-01-01, -02, -03. Asking after -03 → null.
    const rule = 'DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=3'
    expect(nextOccurrence(rule, utc(2026, 0, 3))).toBeNull()
  })

  it('returns null when an UNTIL-bounded rule has ended', () => {
    const rule = 'DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;UNTIL=20260105T000000Z'
    expect(nextOccurrence(rule, utc(2026, 0, 10))).toBeNull()
  })

  it('throws a clear error on an invalid rule string', () => {
    expect(() => nextOccurrence('NOT A RULE')).toThrow(/Invalid RRULE/)
  })
})

describe('occurrencesBetween', () => {
  it('counts daily occurrences over a known inclusive window', () => {
    const rule = 'DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY'
    const occ = occurrencesBetween(rule, utc(2026, 0, 1), utc(2026, 0, 7))
    // Jan 1..7 inclusive = 7 days.
    expect(occ).toHaveLength(7)
    expect(occ[0]?.toISOString().slice(0, 10)).toBe('2026-01-01')
    expect(occ[6]?.toISOString().slice(0, 10)).toBe('2026-01-07')
  })

  it('counts weekly Monday occurrences over a month window', () => {
    const rule = 'RRULE:FREQ=WEEKLY;BYDAY=MO'
    // Mondays in June 2026: 1, 8, 15, 22, 29 → 5.
    const occ = occurrencesBetween(rule, utc(2026, 5, 1), utc(2026, 5, 30))
    expect(occ).toHaveLength(5)
    expect(occ.every((d) => d.getUTCDay() === 1)).toBe(true)
  })

  it('returns an empty array when no occurrences fall in the window', () => {
    const rule = 'DTSTART:20260101T000000Z\nRRULE:FREQ=YEARLY'
    const occ = occurrencesBetween(rule, utc(2026, 5, 1), utc(2026, 5, 30))
    expect(occ).toHaveLength(0)
  })

  it('throws when start is after end', () => {
    expect(() =>
      occurrencesBetween('RRULE:FREQ=DAILY', utc(2026, 0, 10), utc(2026, 0, 1)),
    ).toThrow(/start.*before.*end/i)
  })
})

describe('describeRrule', () => {
  it('produces sensible text for a daily rule', () => {
    expect(describeRrule('RRULE:FREQ=DAILY').toLowerCase()).toContain('day')
  })

  it('produces sensible text for a weekly Monday rule', () => {
    const text = describeRrule('RRULE:FREQ=WEEKLY;BYDAY=MO').toLowerCase()
    expect(text).toContain('week')
    expect(text).toContain('monday')
  })

  it('mentions the interval for an every-2-weeks rule', () => {
    const text = describeRrule('RRULE:FREQ=WEEKLY;INTERVAL=2').toLowerCase()
    expect(text).toContain('2')
    expect(text).toContain('week')
  })
})

describe('isValidRrule', () => {
  it('accepts well-formed rules', () => {
    expect(isValidRrule('RRULE:FREQ=DAILY')).toBe(true)
    expect(isValidRrule('DTSTART:20260101T000000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE')).toBe(true)
    expect(isValidRrule('RRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=4')).toBe(true)
  })

  it('rejects malformed or empty input', () => {
    expect(isValidRrule('this is not a rule')).toBe(false)
    expect(isValidRrule('')).toBe(false)
    expect(isValidRrule('   ')).toBe(false)
    expect(isValidRrule('RRULE:FREQ=NONSENSE')).toBe(false)
  })
})

describe('buildRrule', () => {
  it('builds a daily rule that round-trips through isValidRrule', () => {
    const str = buildRrule({ freq: 'daily' })
    expect(str).toContain('FREQ=DAILY')
    expect(isValidRrule(str)).toBe(true)
  })

  it('builds a weekly rule on specific weekdays', () => {
    const str = buildRrule({ freq: 'weekly', weekdays: ['MO', 'WE', 'FR'] })
    expect(isValidRrule(str)).toBe(true)
    expect(str).toContain('FREQ=WEEKLY')
    expect(str).toContain('BYDAY=MO,WE,FR')
    // round-trip: next occurrence after a Friday is the following Monday.
    const next = nextOccurrence(str, utc(2026, 5, 26)) // Fri 2026-06-26
    expect(next?.getUTCDay()).toBe(1)
  })

  it('builds an interval and applies it via nextOccurrence', () => {
    const str = buildRrule({ freq: 'monthly', interval: 2 })
    expect(str).toContain('INTERVAL=2')
    const next = nextOccurrence(str, utc(2026, 0, 15))
    expect(next?.toISOString().slice(0, 10)).toBe('2026-03-15')
  })

  it('builds a COUNT-bounded rule that ends correctly', () => {
    const str = buildRrule({ freq: 'daily', count: 3 })
    const dt = 'DTSTART:20260101T000000Z\n' + str
    const occ = occurrencesBetween(dt, utc(2026, 0, 1), utc(2026, 0, 31))
    expect(occ).toHaveLength(3)
    expect(nextOccurrence(dt, utc(2026, 0, 3))).toBeNull()
  })

  it('builds an UNTIL-bounded rule', () => {
    const str = buildRrule({ freq: 'daily', until: utc(2026, 0, 5) })
    expect(str).toContain('UNTIL=')
    expect(isValidRrule(str)).toBe(true)
  })

  it('throws on a non-positive interval', () => {
    expect(() => buildRrule({ freq: 'daily', interval: 0 })).toThrow(/interval/)
  })

  it('throws when count and until are both provided', () => {
    expect(() =>
      buildRrule({ freq: 'daily', count: 3, until: utc(2026, 0, 5) }),
    ).toThrow(/mutually exclusive/)
  })

  it('throws on a non-positive count', () => {
    expect(() => buildRrule({ freq: 'daily', count: 0 })).toThrow(/count/)
  })
})
