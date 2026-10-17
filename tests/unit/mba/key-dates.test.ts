import { describe, it, expect } from 'vitest'
import {
  currentAndUpcoming,
  formatRange,
  leaveByYear,
  nextAttendanceBlock,
  overlapping,
  rangeStatus,
  type KeyDate,
} from '@/lib/mba/key-dates'

const kd = (over: Partial<KeyDate> & Pick<KeyDate, 'id' | 'startDate'>): KeyDate => ({
  title: over.id,
  kind: 'in_person',
  endDate: null,
  leaveDays: null,
  year: null,
  notes: null,
  ...over,
})

const DATES: KeyDate[] = [
  kd({ id: 'b3', kind: 'in_person', startDate: '2026-10-07', endDate: '2026-10-11', leaveDays: 2.5, year: 1 }),
  kd({ id: 'b3-online', kind: 'online', startDate: '2026-10-13', endDate: '2026-12-10' }),
  kd({ id: 'break', kind: 'break', startDate: '2026-12-14', endDate: '2027-02-03' }),
  kd({ id: 'b4', kind: 'in_person', startDate: '2027-02-03', endDate: '2027-02-07', leaveDays: 2.5, year: 2 }),
  kd({ id: 'b5', kind: 'hybrid', startDate: '2027-05-12', endDate: '2027-05-16', leaveDays: 2.5, year: 2 }),
  kd({ id: 'elective', kind: 'in_person', startDate: '2027-06-30', endDate: '2027-07-18', leaveDays: 12.5, year: 2 }),
  kd({ id: 'b1', kind: 'in_person', startDate: '2026-02-02', endDate: '2026-02-20', leaveDays: 15, year: 1 }),
  kd({ id: 'final', kind: 'milestone', startDate: '2027-12-06' }),
]

describe('key dates', () => {
  const today = '2026-10-17'

  it('lists in-progress and upcoming dates in start order', () => {
    expect(currentAndUpcoming(DATES, today).map((k) => k.id)).toEqual([
      'b3-online',
      'break',
      'b4',
      'b5',
      'elective',
      'final',
    ])
  })

  it('finds the next in-person/hybrid block (skipping online and breaks)', () => {
    expect(nextAttendanceBlock(DATES, today)?.id).toBe('b4')
    // During a block, that block is "next".
    expect(nextAttendanceBlock(DATES, '2027-02-05')?.id).toBe('b4')
    expect(nextAttendanceBlock(DATES, '2027-02-08')?.id).toBe('b5')
  })

  it('finds dates overlapping a range', () => {
    expect(overlapping(DATES, '2027-02-01', '2027-02-07').map((k) => k.id)).toEqual(['break', 'b4'])
  })

  it('totals leave per year and what is still ahead', () => {
    expect(leaveByYear(DATES, today)).toEqual([
      { year: 1, total: 17.5, remaining: 0 },
      { year: 2, total: 17.5, remaining: 17.5 },
    ])
  })

  it('describes a range relative to today', () => {
    expect(rangeStatus({ startDate: '2026-12-14', endDate: '2027-02-03' }, '2027-02-01')).toBe('until Wed 3 Feb')
    expect(rangeStatus({ startDate: '2027-02-03', endDate: '2027-02-07' }, '2027-02-01')).toBe('starts Wed 3 Feb')
  })

  it('formats ranges compactly', () => {
    expect(formatRange('2027-02-03', '2027-02-07')).toBe('Wed 3 – Sun 7 Feb 2027')
    expect(formatRange('2027-06-30', '2027-07-18')).toBe('30 Jun – 18 Jul 2027')
    expect(formatRange('2026-12-14', '2027-02-03')).toBe('14 Dec 2026 – 3 Feb 2027')
    expect(formatRange('2027-12-06', null)).toBe('Mon 6 Dec 2027')
  })
})
