import { describe, it, expect } from 'vitest'
import { nextTripCountdown, type CountdownTrip } from '@/components/travel/countdown'

const NOW = new Date('2026-06-26T09:00:00.000Z')

function trip(over: Partial<CountdownTrip>): CountdownTrip {
  return { name: 'Trip', startDate: '2026-07-01', status: 'booked', ...over }
}

describe('nextTripCountdown (§9.5)', () => {
  it('returns null when there are no trips', () => {
    expect(nextTripCountdown([], NOW)).toBeNull()
  })

  it('counts whole days to a single upcoming booked trip', () => {
    const result = nextTripCountdown([trip({ name: 'Lisbon', startDate: '2026-07-08' })], NOW)
    expect(result).not.toBeNull()
    expect(result!.tripName).toBe('Lisbon')
    expect(result!.days).toBe(12)
    expect(result!.label).toBe('12 days until Lisbon')
    expect(result!.startDate).toBe('2026-07-08')
  })

  it('uses singular "day" when exactly one day away', () => {
    const result = nextTripCountdown([trip({ name: 'Cape Town', startDate: '2026-06-27' })], NOW)
    expect(result!.days).toBe(1)
    expect(result!.label).toBe('1 day until Cape Town')
  })

  it('picks the soonest eligible trip among several', () => {
    const result = nextTripCountdown(
      [
        trip({ name: 'Far', startDate: '2026-09-01' }),
        trip({ name: 'Soon', startDate: '2026-07-02' }),
        trip({ name: 'Mid', startDate: '2026-08-01' }),
      ],
      NOW,
    )
    expect(result!.tripName).toBe('Soon')
  })

  it("ignores trips whose status is not 'planning' or 'booked'", () => {
    const result = nextTripCountdown(
      [
        trip({ name: 'Idea', startDate: '2026-06-28', status: 'idea' }),
        trip({ name: 'Done', startDate: '2026-06-29', status: 'completed' }),
        trip({ name: 'Planned', startDate: '2026-07-05', status: 'planning' }),
      ],
      NOW,
    )
    expect(result!.tripName).toBe('Planned')
  })

  it('ignores trips that have already started (start not strictly after now)', () => {
    const result = nextTripCountdown(
      [
        trip({ name: 'Today', startDate: '2026-06-26' }),
        trip({ name: 'Yesterday', startDate: '2026-06-25' }),
      ],
      NOW,
    )
    expect(result).toBeNull()
  })

  it('ignores trips with no start date', () => {
    const result = nextTripCountdown(
      [
        trip({ name: 'No date', startDate: null }),
        trip({ name: 'Dated', startDate: '2026-07-10' }),
      ],
      NOW,
    )
    expect(result!.tripName).toBe('Dated')
  })

  it('is independent of the time-of-day component of now', () => {
    const late = new Date('2026-06-26T23:59:59.000Z')
    const result = nextTripCountdown([trip({ name: 'X', startDate: '2026-06-28' })], late)
    expect(result!.days).toBe(2)
  })
})
