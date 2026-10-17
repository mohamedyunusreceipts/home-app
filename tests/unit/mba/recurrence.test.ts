import { describe, it, expect } from 'vitest'
import { parseICal } from '@/lib/mba/ical'
import { expandEvents } from '@/lib/mba/recurrence'

const cal = (...lines: string[]) => ['BEGIN:VCALENDAR', ...lines, 'END:VCALENDAR'].join('\r\n')

// Weekly Tuesday 19:00 SAST team meeting, 4 instances: 20, 27 Oct, 3, 10 Nov.
const SERIES = [
  'BEGIN:VEVENT',
  'UID:triad-weekly',
  'SUMMARY:PPM Triad team meeting',
  'DTSTART;TZID=South Africa Standard Time:20261020T190000',
  'DTEND;TZID=South Africa Standard Time:20261020T200000',
  'RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=TU',
  'END:VEVENT',
]

const WINDOW: [Date, Date] = [new Date('2026-10-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z')]
const starts = (occ: { start: Date }[]) => occ.map((o) => o.start.toISOString())

describe('expandEvents', () => {
  it('expands a weekly series at the local wall-clock time', () => {
    const occ = expandEvents(parseICal(cal(...SERIES)), ...WINDOW)
    expect(starts(occ)).toEqual([
      '2026-10-20T17:00:00.000Z',
      '2026-10-27T17:00:00.000Z',
      '2026-11-03T17:00:00.000Z',
      '2026-11-10T17:00:00.000Z',
    ])
    expect(occ[0]!.end!.toISOString()).toBe('2026-10-20T18:00:00.000Z')
    // Each occurrence gets its own stable uid.
    expect(new Set(occ.map((o) => o.uid)).size).toBe(4)
  })

  it('drops EXDATE instances', () => {
    const lines = [...SERIES]
    lines.splice(5, 0, 'EXDATE;TZID=South Africa Standard Time:20261027T190000,20261103T190000')
    expect(starts(expandEvents(parseICal(cal(...lines)), ...WINDOW))).toEqual([
      '2026-10-20T17:00:00.000Z',
      '2026-11-10T17:00:00.000Z',
    ])
  })

  it('replaces an instance moved by a RECURRENCE-ID override', () => {
    const occ = expandEvents(
      parseICal(
        cal(
          ...SERIES,
          'BEGIN:VEVENT',
          'UID:triad-weekly',
          'RECURRENCE-ID;TZID=South Africa Standard Time:20261027T190000',
          'SUMMARY:PPM Triad team meeting (moved)',
          'DTSTART;TZID=South Africa Standard Time:20261028T180000',
          'END:VEVENT',
        ),
      ),
      ...WINDOW,
    )
    expect(starts(occ)).toEqual([
      '2026-10-20T17:00:00.000Z',
      '2026-10-28T16:00:00.000Z',
      '2026-11-03T17:00:00.000Z',
      '2026-11-10T17:00:00.000Z',
    ])
    expect(occ[1]!.summary).toContain('moved')
  })

  it('removes an instance cancelled by override, and skips cancelled events', () => {
    const occ = expandEvents(
      parseICal(
        cal(
          ...SERIES,
          'BEGIN:VEVENT',
          'UID:triad-weekly',
          'RECURRENCE-ID;TZID=South Africa Standard Time:20261103T190000',
          'STATUS:CANCELLED',
          'DTSTART;TZID=South Africa Standard Time:20261103T190000',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:gone',
          'STATUS:CANCELLED',
          'DTSTART:20261021T100000Z',
          'END:VEVENT',
        ),
      ),
      ...WINDOW,
    )
    expect(starts(occ)).toEqual([
      '2026-10-20T17:00:00.000Z',
      '2026-10-27T17:00:00.000Z',
      '2026-11-10T17:00:00.000Z',
    ])
  })

  it('keeps local time across a DST change', () => {
    // London: 09:00 BST (08:00Z) before 25 Oct 2026, 09:00 GMT (09:00Z) after.
    const occ = expandEvents(
      parseICal(
        cal(
          'BEGIN:VEVENT',
          'UID:london',
          'SUMMARY:x',
          'DTSTART;TZID=Europe/London:20261019T090000',
          'RRULE:FREQ=WEEKLY;COUNT=2',
          'END:VEVENT',
        ),
      ),
      ...WINDOW,
    )
    expect(starts(occ)).toEqual(['2026-10-19T08:00:00.000Z', '2026-10-26T09:00:00.000Z'])
  })

  it('honours the window and leaves single events alone', () => {
    const occ = expandEvents(
      parseICal(
        cal(
          'BEGIN:VEVENT',
          'UID:once',
          'SUMMARY:one-off',
          'DTSTART:20261105T120000Z',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:old',
          'SUMMARY:old',
          'DTSTART:20250105T120000Z',
          'END:VEVENT',
        ),
      ),
      ...WINDOW,
    )
    expect(occ.map((o) => o.uid)).toEqual(['once'])
  })
})
