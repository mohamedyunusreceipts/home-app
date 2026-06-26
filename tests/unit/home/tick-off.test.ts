import { describe, it, expect } from 'vitest'
import { computeTickOff } from '@/components/home/map'

describe('computeTickOff — pure tick-off logic', () => {
  const now = new Date('2026-06-26T08:00:00.000Z')

  it('stamps last_done_at and last_done_by', () => {
    const patch = computeTickOff(null, 'user-1', now)
    expect(patch.last_done_at).toBe(now.toISOString())
    expect(patch.last_done_by).toBe('user-1')
  })

  it('leaves next_due null for a non-recurring item', () => {
    expect(computeTickOff(null, 'user-1', now).next_due).toBeNull()
    expect(computeTickOff('', 'user-1', now).next_due).toBeNull()
    expect(computeTickOff('   ', 'user-1', now).next_due).toBeNull()
  })

  it('advances next_due to the next daily occurrence', () => {
    const patch = computeTickOff('FREQ=DAILY', 'user-1', now)
    // Next daily occurrence strictly after 2026-06-26 is 2026-06-27.
    expect(patch.next_due).toBe('2026-06-27')
  })

  it('advances next_due to the next weekly occurrence on the chosen weekday', () => {
    // 2026-06-26 is a Friday; next Monday is 2026-06-29.
    const patch = computeTickOff('FREQ=WEEKLY;BYDAY=MO', 'user-1', now)
    expect(patch.next_due).toBe('2026-06-29')
  })

  it('honours an interval (every 2 weeks)', () => {
    const patch = computeTickOff('FREQ=WEEKLY;INTERVAL=2', 'user-1', now)
    // Anchored at now, the next occurrence is two weeks on: 2026-07-10.
    expect(patch.next_due).toBe('2026-07-10')
  })

  it('does not throw on an unparseable rule — leaves next_due null', () => {
    const patch = computeTickOff('NOT-AN-RRULE', 'user-1', now)
    expect(patch.next_due).toBeNull()
    expect(patch.last_done_by).toBe('user-1')
  })

  it('accepts a null user id (joint / unattributed)', () => {
    const patch = computeTickOff('FREQ=DAILY', null, now)
    expect(patch.last_done_by).toBeNull()
    expect(patch.next_due).toBe('2026-06-27')
  })
})
