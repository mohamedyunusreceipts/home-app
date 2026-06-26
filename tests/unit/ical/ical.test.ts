import { describe, it, expect } from 'vitest'
import { buildICalendar, type CalendarRow } from '@/lib/ical'

const baseRow = (overrides: Partial<CalendarRow> = {}): CalendarRow => ({
  household_id: '11111111-1111-1111-1111-111111111111',
  source: 'bills',
  source_id: '22222222-2222-2222-2222-222222222222',
  title: 'Rent due',
  start: '2026-06-26T00:00:00.000Z',
  end: '2026-06-26T00:00:00.000Z',
  all_day: true,
  category: 'bills',
  link: '/money',
  ...overrides,
})

describe('buildICalendar', () => {
  it('wraps events in a VCALENDAR 2.0 envelope', () => {
    const ics = buildICalendar([baseRow()])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:')
    expect(ics).toContain('END:VCALENDAR')
    // CRLF line endings per RFC 5545.
    expect(ics).toContain('\r\n')
  })

  it('emits a VEVENT with a stable UID derived from source + source_id', () => {
    const ics = buildICalendar([baseRow()])
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('UID:bills-22222222-2222-2222-2222-222222222222@home.app')
  })

  it('renders all-day events as VALUE=DATE', () => {
    const ics = buildICalendar([baseRow({ all_day: true })])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260626')
    expect(ics).toContain('DTEND;VALUE=DATE:20260626')
  })

  it('renders timed events as UTC date-times', () => {
    const ics = buildICalendar([
      baseRow({
        all_day: false,
        source: 'manual',
        title: 'Dentist',
        start: '2026-06-26T14:30:00.000Z',
        end: '2026-06-26T15:30:00.000Z',
      }),
    ])
    expect(ics).toContain('DTSTART:20260626T143000Z')
    expect(ics).toContain('DTEND:20260626T153000Z')
  })

  it('includes SUMMARY and CATEGORIES (capitalised)', () => {
    const ics = buildICalendar([baseRow({ title: 'Rent due', category: 'bills' })])
    expect(ics).toContain('SUMMARY:Rent due')
    expect(ics).toContain('CATEGORIES:Bills')
  })

  it('builds an absolute deep link in DESCRIPTION and URL when appUrl is given', () => {
    const ics = buildICalendar([baseRow({ link: '/travel/abc' })], {
      appUrl: 'https://home.example.com/',
    })
    expect(ics).toContain('https://home.example.com/travel/abc')
    expect(ics).toContain('URL:https://home.example.com/travel/abc')
  })

  it('falls back to the relative link when no appUrl is provided', () => {
    const ics = buildICalendar([baseRow({ link: '/money' })])
    expect(ics).toContain('Open in Home: /money')
  })

  it('escapes TEXT special characters (comma, semicolon, backslash, newline)', () => {
    const ics = buildICalendar([
      baseRow({ title: 'Pay rent; water, lights\\notes\nline2', link: null }),
    ])
    expect(ics).toContain('SUMMARY:Pay rent\\; water\\, lights\\\\notes\\nline2')
  })

  it('folds long content lines at 75 octets with a leading-space continuation', () => {
    const longTitle = 'A'.repeat(200)
    const ics = buildICalendar([baseRow({ title: longTitle, link: null })])
    const lines = ics.split('\r\n')
    // No content line exceeds 75 chars.
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75)
    }
    // Continuation lines begin with a space.
    const summaryIdx = lines.findIndex((l) => l.startsWith('SUMMARY:'))
    expect(summaryIdx).toBeGreaterThanOrEqual(0)
    expect(lines[summaryIdx + 1]!.startsWith(' ')).toBe(true)
  })

  it('produces one VEVENT per row', () => {
    const ics = buildICalendar([
      baseRow({ source_id: 'a' }),
      baseRow({ source: 'chores', source_id: 'b', category: 'chores' }),
      baseRow({ source: 'trips', source_id: 'c', category: 'trips' }),
    ])
    const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length
    expect(count).toBe(3)
  })

  it('skips rows with an unparseable start date', () => {
    const ics = buildICalendar([baseRow({ start: 'not-a-date', end: null })])
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('handles an empty row list (valid empty calendar)', () => {
    const ics = buildICalendar([])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
