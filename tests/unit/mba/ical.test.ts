import { describe, it, expect } from 'vitest'
import { parseICal, zonedToUtc } from '@/lib/mba/ical'

const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//D2L//Calendar//EN',
  'BEGIN:VEVENT',
  'UID:6606-123@lms.example',
  'SUMMARY:Group Assignment - Due',
  'DESCRIPTION:Report and video\\, max 10 pages.\\nSubmit as PDF\\; one per group.',
  'LOCATION:MBA MOD 2026/27 MKT | Marketing',
  'DTSTART:20261108T160000Z',
  'DTEND:20261108T160000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:abc-2',
  // Folded line (RFC 5545: CRLF + single space continues the previous line).
  'SUMMARY:Pitch presentation 1 - Availab',
  ' ility Ends',
  'DTSTART;TZID=Africa/Johannesburg:20261020T190000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:abc-3',
  'SUMMARY:Ethics training',
  'DTSTART;VALUE=DATE:20261022',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseICal', () => {
  const events = parseICal(FEED)

  it('parses every VEVENT', () => {
    expect(events.map((e) => e.uid)).toEqual(['6606-123@lms.example', 'abc-2', 'abc-3'])
  })

  it('unescapes text values', () => {
    expect(events[0]!.description).toBe(
      'Report and video, max 10 pages.\nSubmit as PDF; one per group.',
    )
    expect(events[0]!.location).toBe('MBA MOD 2026/27 MKT | Marketing')
  })

  it('reads UTC timestamps', () => {
    expect(events[0]!.start.toISOString()).toBe('2026-11-08T16:00:00.000Z')
    expect(events[0]!.allDay).toBe(false)
  })

  it('unfolds continuation lines', () => {
    expect(events[1]!.summary).toBe('Pitch presentation 1 - Availability Ends')
  })

  it('converts TZID local times to UTC (SAST = UTC+2)', () => {
    expect(events[1]!.start.toISOString()).toBe('2026-10-20T17:00:00.000Z')
  })

  it('treats VALUE=DATE as all-day, due 23:59 local', () => {
    expect(events[2]!.allDay).toBe(true)
    expect(events[2]!.start.toISOString()).toBe('2026-10-22T21:59:00.000Z')
  })

  it('maps Windows timezone names and falls back for unknown zones', () => {
    const feed = [
      'BEGIN:VEVENT',
      'UID:w1',
      'SUMMARY:x',
      'DTSTART;TZID="South Africa Standard Time":20261020T190000',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:w2',
      'SUMMARY:y',
      'DTSTART;TZID=Not/AZone:20261020T190000',
      'END:VEVENT',
    ].join('\n')
    const [a, b] = parseICal(feed)
    expect(a!.start.toISOString()).toBe('2026-10-20T17:00:00.000Z')
    expect(b!.start.toISOString()).toBe('2026-10-20T17:00:00.000Z')
  })

  it('skips events without a UID or start', () => {
    const feed = ['BEGIN:VEVENT', 'SUMMARY:no uid', 'DTSTART:20261020T190000Z', 'END:VEVENT'].join('\n')
    expect(parseICal(feed)).toEqual([])
  })
})

describe('zonedToUtc', () => {
  it('handles a DST zone on both sides of the change', () => {
    // London: GMT (UTC+0) in January, BST (UTC+1) in July.
    expect(zonedToUtc(2026, 1, 15, 12, 0, 0, 'Europe/London').toISOString()).toBe(
      '2026-01-15T12:00:00.000Z',
    )
    expect(zonedToUtc(2026, 7, 15, 12, 0, 0, 'Europe/London').toISOString()).toBe(
      '2026-07-15T11:00:00.000Z',
    )
  })
})
