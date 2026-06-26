import { describe, it, expect } from 'vitest'
import { buildMonthGrid, bucketByDay, stepMonth, dayKeyOf } from '@/components/calendar/month'
import type { CalendarEventRow } from '@/components/calendar/types'

describe('buildMonthGrid', () => {
  it('produces a 42-cell grid', () => {
    const grid = buildMonthGrid(2026, 6)
    expect(grid).toHaveLength(42)
  })

  it('marks in-month days correctly (June 2026 has 30 days)', () => {
    const grid = buildMonthGrid(2026, 6)
    const inMonth = grid.filter((c) => c.inMonth)
    expect(inMonth).toHaveLength(30)
    expect(inMonth[0]!.day).toBe(1)
    expect(inMonth[29]!.day).toBe(30)
  })

  it('starts the week on Monday — 1 June 2026 is a Monday, so no lead-in pad', () => {
    const grid = buildMonthGrid(2026, 6)
    // First cell should be the 1st (in-month) since June 1 2026 is a Monday.
    expect(grid[0]!.key).toBe('2026-06-01')
    expect(grid[0]!.inMonth).toBe(true)
  })

  it('pads the start for a month that does not begin on Monday (July 2026)', () => {
    // July 1 2026 is a Wednesday → two lead-in days (Mon 29, Tue 30 June).
    const grid = buildMonthGrid(2026, 7)
    expect(grid[0]!.inMonth).toBe(false)
    expect(grid[0]!.key).toBe('2026-06-29')
    expect(grid[2]!.key).toBe('2026-07-01')
    expect(grid[2]!.inMonth).toBe(true)
  })
})

describe('stepMonth', () => {
  it('steps forward across a year boundary', () => {
    expect(stepMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })
  it('steps backward across a year boundary', () => {
    expect(stepMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })
  it('is a no-op for delta 0', () => {
    expect(stepMonth(2026, 6, 0)).toEqual({ year: 2026, month: 6 })
  })
})

describe('bucketByDay', () => {
  const row = (overrides: Partial<CalendarEventRow>): CalendarEventRow => ({
    household_id: 'h',
    source: 'bills',
    source_id: 's',
    title: 'X',
    start: '2026-07-05T00:00:00.000Z',
    end: '2026-07-05T00:00:00.000Z',
    all_day: true,
    category: 'bills',
    link: null,
    ...overrides,
  })

  it('buckets a single all-day event on its start day', () => {
    const map = bucketByDay([row({})])
    // dayKeyOf in Africa/Johannesburg: 2026-07-05T00:00Z is 02:00 local → 5 July.
    expect(map.get(dayKeyOf('2026-07-05T00:00:00.000Z'))).toHaveLength(1)
  })

  it('spreads a multi-day all-day span across each covered day (end exclusive)', () => {
    // Trip: start 2026-08-01, exclusive end 2026-08-04 → covers 1,2,3 (3 days).
    const map = bucketByDay([
      row({
        source: 'trips',
        category: 'trips',
        start: '2026-08-01T00:00:00.000Z',
        end: '2026-08-04T00:00:00.000Z',
      }),
    ])
    const covered = [...map.keys()].filter((k) => k.startsWith('2026-08'))
    expect(covered.sort()).toEqual(['2026-08-01', '2026-08-02', '2026-08-03'])
  })

  it('buckets a timed event on its start day only', () => {
    const map = bucketByDay([
      row({ all_day: false, start: '2026-07-09T12:00:00.000Z', end: '2026-07-09T13:00:00.000Z' }),
    ])
    expect([...map.keys()]).toEqual([dayKeyOf('2026-07-09T12:00:00.000Z')])
  })
})
