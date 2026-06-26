// Pure countdown helper for the Travel module (spec §9.5).
//
// Given a set of trips, compute "N days until <trip>" for the NEXT upcoming trip,
// defined (per spec) as the trip with the smallest start date where
// `status in ('planning','booked') and start > now()`.
//
// This module is intentionally dependency-free and unit-tested so the same logic
// can back both the per-trip pages and the global dashboard Trip-countdown card.

/** Minimal trip shape the countdown needs. Maps from a `trips` DB row. */
export interface CountdownTrip {
  name: string
  /** ISO date (yyyy-mm-dd) or null for trips with no start yet. */
  startDate: string | null
  status: 'idea' | 'planning' | 'booked' | 'completed'
}

export interface Countdown {
  /** The chosen upcoming trip's name. */
  tripName: string
  /** Whole days from `now` until the trip's start (always >= 1). */
  days: number
  /** The trip's start date, echoed back as an ISO date string. */
  startDate: string
  /** Pre-built label, e.g. "12 days until Lisbon" / "1 day until Lisbon". */
  label: string
}

/** Statuses that make a trip eligible for the countdown. */
const COUNTDOWN_STATUSES = new Set(['planning', 'booked'])

/** Parse an ISO date (yyyy-mm-dd) to a UTC-midnight timestamp, or null. */
function startOfUtcDay(iso: string): number | null {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Return the countdown to the next eligible trip, or null when none qualifies.
 *
 * "Next" = smallest startDate strictly after `now`, among trips whose status is
 * 'planning' or 'booked'. Day counts are computed on UTC day boundaries so a trip
 * starting "tomorrow" reads as 1 day regardless of the time of day `now` falls on.
 *
 * @param trips the candidate trips
 * @param now   the reference instant (defaults to the current time)
 */
export function nextTripCountdown(
  trips: readonly CountdownTrip[],
  now: Date = new Date(),
): Countdown | null {
  const nowDay = startOfUtcDay(now.toISOString())
  if (nowDay == null) return null

  let best: { trip: CountdownTrip; startMs: number } | null = null

  for (const trip of trips) {
    if (!COUNTDOWN_STATUSES.has(trip.status)) continue
    if (!trip.startDate) continue
    const startMs = startOfUtcDay(trip.startDate)
    if (startMs == null) continue
    if (startMs <= nowDay) continue // must be strictly in the future (by day)
    if (best == null || startMs < best.startMs) {
      best = { trip, startMs }
    }
  }

  if (!best) return null

  const days = Math.round((best.startMs - nowDay) / MS_PER_DAY)
  return {
    tripName: best.trip.name,
    days,
    startDate: best.trip.startDate!.slice(0, 10),
    label: `${days} ${days === 1 ? 'day' : 'days'} until ${best.trip.name}`,
  }
}
