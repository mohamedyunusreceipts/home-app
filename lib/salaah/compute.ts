import { Coordinates, CalculationMethod, Madhab, PrayerTimes } from 'adhan'

/** adhan's CalculationParameters type, derived without a deep package import. */
type CalculationParameters = ReturnType<typeof CalculationMethod.MuslimWorldLeague>

/**
 * Pure salaah (Islamic prayer time) computation, shared by the UI and the cron
 * endpoint. No I/O, no React, no Supabase — everything here is deterministic
 * given (coords, method, madhab, date), so it is fully unit-testable and safe to
 * run both in the browser and on the server.
 *
 * Times are produced offline by the `adhan` library (no external API).
 */

/** A preset location the couple can pick from the dropdown. */
export interface PresetLocation {
  name: string
  lat: number
  lng: number
  timezone: string
}

/**
 * Curated preset locations. South African cities first (the app's home market),
 * then a few common international ones. Cape Town is the app default.
 */
export const PRESET_LOCATIONS: readonly PresetLocation[] = [
  { name: 'Cape Town', lat: -33.9249, lng: 18.4241, timezone: 'Africa/Johannesburg' },
  { name: 'Johannesburg', lat: -26.2041, lng: 28.0473, timezone: 'Africa/Johannesburg' },
  { name: 'Durban', lat: -29.8587, lng: 31.0218, timezone: 'Africa/Johannesburg' },
  { name: 'Pretoria', lat: -25.7479, lng: 28.2293, timezone: 'Africa/Johannesburg' },
  { name: 'Gqeberha', lat: -33.9608, lng: 25.6022, timezone: 'Africa/Johannesburg' },
  { name: 'Bloemfontein', lat: -29.0852, lng: 26.1596, timezone: 'Africa/Johannesburg' },
  { name: 'Mecca', lat: 21.3891, lng: 39.8579, timezone: 'Asia/Riyadh' },
  { name: 'Madinah', lat: 24.4686, lng: 39.6142, timezone: 'Asia/Riyadh' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, timezone: 'Asia/Dubai' },
  { name: 'London', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London' },
  { name: 'New York', lat: 40.7128, lng: -74.006, timezone: 'America/New_York' },
] as const

/** The default location used when a household has not saved settings yet. */
export const DEFAULT_LOCATION: PresetLocation = PRESET_LOCATIONS[0]!

/** Calculation methods: a stable key, a human label, and the adhan factory. */
export const METHODS: Record<string, { label: string; build: () => CalculationParameters }> = {
  MuslimWorldLeague: { label: 'Muslim World League', build: CalculationMethod.MuslimWorldLeague },
  Egyptian: { label: 'Egyptian', build: CalculationMethod.Egyptian },
  Karachi: { label: 'Karachi', build: CalculationMethod.Karachi },
  UmmAlQura: { label: 'Umm al-Qura', build: CalculationMethod.UmmAlQura },
  Dubai: { label: 'Dubai', build: CalculationMethod.Dubai },
  MoonsightingCommittee: { label: 'Moonsighting Committee', build: CalculationMethod.MoonsightingCommittee },
  NorthAmerica: { label: 'ISNA (N. America)', build: CalculationMethod.NorthAmerica },
  Kuwait: { label: 'Kuwait', build: CalculationMethod.Kuwait },
  Qatar: { label: 'Qatar', build: CalculationMethod.Qatar },
  Singapore: { label: 'Singapore', build: CalculationMethod.Singapore },
  Turkey: { label: 'Turkey', build: CalculationMethod.Turkey },
  Tehran: { label: 'Tehran', build: CalculationMethod.Tehran },
}

export type MethodKey = keyof typeof METHODS
export const DEFAULT_METHOD = 'MuslimWorldLeague'

/** Madhab affects the Asr time (shadow length 1 = Shafi, 2 = Hanafi). */
export const MADHABS: Record<string, { label: string; value: (typeof Madhab)[keyof typeof Madhab] }> = {
  shafi: { label: 'Shafi', value: Madhab.Shafi },
  hanafi: { label: 'Hanafi', value: Madhab.Hanafi },
}

export type MadhabKey = keyof typeof MADHABS
export const DEFAULT_MADHAB = 'shafi'

/** The five obligatory prayers plus sunrise (a boundary, not a prayer). */
export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

/** The five notifiable prayers (sunrise is informational only). */
export const NOTIFIABLE_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type NotifiablePrayer = (typeof NOTIFIABLE_PRAYERS)[number]

export interface ComputedTimes {
  fajr: Date
  sunrise: Date
  dhuhr: Date
  asr: Date
  maghrib: Date
  isha: Date
}

export interface ComputeInput {
  lat: number
  lng: number
  methodKey: string
  madhabKey: string
  date: Date
}

/** Resolve a method key to adhan params, falling back to the default if unknown. */
function buildParams(methodKey: string, madhabKey: string): CalculationParameters {
  const method = METHODS[methodKey] ?? METHODS[DEFAULT_METHOD]!
  const params = method.build()
  const madhab = MADHABS[madhabKey] ?? MADHABS[DEFAULT_MADHAB]!
  params.madhab = madhab.value
  return params
}

/**
 * Compute the six daily times for a location/method/madhab on a given date.
 * The returned values are absolute Date instants (UTC under the hood); format
 * them in the location's timezone for display.
 */
export function computePrayerTimes({
  lat,
  lng,
  methodKey,
  madhabKey,
  date,
}: ComputeInput): ComputedTimes {
  const coords = new Coordinates(lat, lng)
  const params = buildParams(methodKey, madhabKey)
  const pt = new PrayerTimes(coords, date, params)
  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  }
}

export interface NextPrayer {
  name: NotifiablePrayer
  time: Date
}

/**
 * The next upcoming obligatory prayer relative to `now`. Sunrise is skipped (it
 * is not a prayer). If `now` is past Isha, returns tomorrow's Fajr — so the UI
 * always has a forward-looking countdown.
 */
export function nextPrayer(times: ComputedTimes, now: Date): NextPrayer {
  const ordered: { name: NotifiablePrayer; time: Date }[] = [
    { name: 'fajr', time: times.fajr },
    { name: 'dhuhr', time: times.dhuhr },
    { name: 'asr', time: times.asr },
    { name: 'maghrib', time: times.maghrib },
    { name: 'isha', time: times.isha },
  ]
  for (const p of ordered) {
    if (p.time.getTime() > now.getTime()) return p
  }
  // Past Isha → tomorrow's Fajr. We can't recompute here without coords, so the
  // caller passes a times object; recompute is done by computeNextDayFajr below.
  return { name: 'isha', time: times.isha }
}

/**
 * The next prayer accounting for day rollover: if `now` is past today's Isha,
 * compute tomorrow's Fajr from the same coords/method/madhab. This is the
 * function the UI and cron should use for an always-forward countdown.
 */
export function nextPrayerAcrossDays(
  input: Omit<ComputeInput, 'date'> & { now: Date },
): NextPrayer {
  const { now } = input
  const today = computePrayerTimes({ ...input, date: now })
  const next = nextPrayer(today, now)
  if (next.time.getTime() > now.getTime()) return next
  // Past Isha → tomorrow's Fajr.
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const t = computePrayerTimes({ ...input, date: tomorrow })
  return { name: 'fajr', time: t.fajr }
}
