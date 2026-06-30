import { describe, it, expect } from 'vitest'
import {
  PRESET_LOCATIONS,
  DEFAULT_LOCATION,
  computePrayerTimes,
  nextPrayer,
  nextPrayerAcrossDays,
  type ComputedTimes,
} from '@/lib/salaah/compute'

// Johannesburg coords (a preset). A fixed date keeps the assertions deterministic.
const JHB = PRESET_LOCATIONS.find((p) => p.name === 'Johannesburg')!
const FIXED_DATE = new Date('2026-06-30T09:00:00+02:00')

function jhbTimes(): ComputedTimes {
  return computePrayerTimes({
    lat: JHB.lat,
    lng: JHB.lng,
    methodKey: 'MuslimWorldLeague',
    madhabKey: 'shafi',
    date: FIXED_DATE,
  })
}

/** Hour-of-day in JHB (UTC+2, no DST) for an instant. */
function jhbHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Africa/Johannesburg',
    }).format(d),
  )
}

describe('salaah/compute', () => {
  it('Cape Town is the default location', () => {
    expect(DEFAULT_LOCATION.name).toBe('Cape Town')
    expect(DEFAULT_LOCATION.lat).toBeCloseTo(-33.9249, 3)
    expect(DEFAULT_LOCATION.lng).toBeCloseTo(18.4241, 3)
  })

  it('Johannesburg times are correctly ordered through the day', () => {
    const t = jhbTimes()
    expect(t.fajr.getTime()).toBeLessThan(t.sunrise.getTime())
    expect(t.sunrise.getTime()).toBeLessThan(t.dhuhr.getTime())
    expect(t.dhuhr.getTime()).toBeLessThan(t.asr.getTime())
    expect(t.asr.getTime()).toBeLessThan(t.maghrib.getTime())
    expect(t.maghrib.getTime()).toBeLessThan(t.isha.getTime())
  })

  it('Johannesburg times fall in expected local-hour ranges (winter)', () => {
    const t = jhbTimes()
    // Late-June JHB: Fajr ~05:xx, sunrise ~06:xx, Dhuhr ~12:xx,
    // Asr ~14–15, Maghrib ~17:xx, Isha ~18–19.
    expect(jhbHour(t.fajr)).toBeGreaterThanOrEqual(4)
    expect(jhbHour(t.fajr)).toBeLessThanOrEqual(6)
    expect(jhbHour(t.sunrise)).toBeGreaterThanOrEqual(5)
    expect(jhbHour(t.sunrise)).toBeLessThanOrEqual(7)
    expect(jhbHour(t.dhuhr)).toBe(12)
    expect(jhbHour(t.asr)).toBeGreaterThanOrEqual(14)
    expect(jhbHour(t.asr)).toBeLessThanOrEqual(15)
    expect(jhbHour(t.maghrib)).toBeGreaterThanOrEqual(17)
    expect(jhbHour(t.maghrib)).toBeLessThanOrEqual(18)
    expect(jhbHour(t.isha)).toBeGreaterThanOrEqual(17)
    expect(jhbHour(t.isha)).toBeLessThanOrEqual(19)
  })

  it('Hanafi Asr is later than Shafi Asr (longer shadow)', () => {
    const shafi = computePrayerTimes({
      lat: JHB.lat,
      lng: JHB.lng,
      methodKey: 'MuslimWorldLeague',
      madhabKey: 'shafi',
      date: FIXED_DATE,
    })
    const hanafi = computePrayerTimes({
      lat: JHB.lat,
      lng: JHB.lng,
      methodKey: 'MuslimWorldLeague',
      madhabKey: 'hanafi',
      date: FIXED_DATE,
    })
    expect(hanafi.asr.getTime()).toBeGreaterThan(shafi.asr.getTime())
  })

  it('an unknown method/madhab key falls back to defaults (no throw)', () => {
    const t = computePrayerTimes({
      lat: JHB.lat,
      lng: JHB.lng,
      methodKey: 'NotAMethod',
      madhabKey: 'nope',
      date: FIXED_DATE,
    })
    expect(t.fajr.getTime()).toBeLessThan(t.isha.getTime())
  })

  describe('nextPrayer', () => {
    it('returns the first prayer strictly after now', () => {
      const t = jhbTimes()
      // Just before Dhuhr → next is Dhuhr.
      const justBeforeDhuhr = new Date(t.dhuhr.getTime() - 60_000)
      expect(nextPrayer(t, justBeforeDhuhr).name).toBe('dhuhr')

      // Just after Asr → next is Maghrib.
      const justAfterAsr = new Date(t.asr.getTime() + 60_000)
      expect(nextPrayer(t, justAfterAsr).name).toBe('maghrib')

      // Before Fajr → next is Fajr.
      const beforeFajr = new Date(t.fajr.getTime() - 60_000)
      expect(nextPrayer(t, beforeFajr).name).toBe('fajr')
    })
  })

  describe('nextPrayerAcrossDays', () => {
    it('after Isha, rolls over to tomorrow morning Fajr', () => {
      const t = jhbTimes()
      const afterIsha = new Date(t.isha.getTime() + 60_000)
      const next = nextPrayerAcrossDays({
        lat: JHB.lat,
        lng: JHB.lng,
        methodKey: 'MuslimWorldLeague',
        madhabKey: 'shafi',
        now: afterIsha,
      })
      expect(next.name).toBe('fajr')
      // The rolled-over Fajr must be in the future relative to "now".
      expect(next.time.getTime()).toBeGreaterThan(afterIsha.getTime())
      // And it should be the following morning (within ~24h).
      expect(next.time.getTime() - afterIsha.getTime()).toBeLessThan(24 * 3600 * 1000)
    })

    it('mid-morning returns a same-day upcoming prayer', () => {
      const next = nextPrayerAcrossDays({
        lat: JHB.lat,
        lng: JHB.lng,
        methodKey: 'MuslimWorldLeague',
        madhabKey: 'shafi',
        now: FIXED_DATE, // 09:00 local
      })
      expect(next.time.getTime()).toBeGreaterThan(FIXED_DATE.getTime())
      expect(['dhuhr', 'asr', 'maghrib', 'isha']).toContain(next.name)
    })
  })
})
