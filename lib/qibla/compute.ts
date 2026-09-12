// Qibla direction + distance to the Kaaba. Pure, dependency-free math so it can
// be unit-tested and run on both server and client.
//
// The Qibla is the great-circle *initial bearing* from the observer to the
// Kaaba — the direction you set off in to reach it by the shortest path over the
// sphere. This is the direction Muslims face for prayer.

/** The Kaaba, Masjid al-Haram, Makkah. 21°25′21″N 39°49′34″E. */
export const KAABA = { lat: 21.4225, lng: 39.8262 } as const

/** Mean Earth radius (km), for the distance calculation. */
const EARTH_RADIUS_KM = 6371

const toRad = (deg: number): number => (deg * Math.PI) / 180
const toDeg = (rad: number): number => (rad * 180) / Math.PI

/** Normalise any angle in degrees to the [0, 360) range. */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * Initial great-circle bearing (degrees clockwise from true North, 0–360) from
 * the given point to the Kaaba. Undefined behaviour exactly at the Kaaba (the
 * bearing is meaningless there); callers should treat distance ≈ 0 specially.
 */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = toRad(lat)
  const φ2 = toRad(KAABA.lat)
  const Δλ = toRad(KAABA.lng - lng)

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)

  return normalizeDeg(toDeg(Math.atan2(y, x)))
}

/** Great-circle (haversine) distance in km from the point to the Kaaba. */
export function distanceToKaabaKm(lat: number, lng: number): number {
  const φ1 = toRad(lat)
  const φ2 = toRad(KAABA.lat)
  const Δφ = toRad(KAABA.lat - lat)
  const Δλ = toRad(KAABA.lng - lng)

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const

export type CompassPoint = (typeof COMPASS_16)[number]

/** Nearest 16-point compass label for a bearing in degrees (e.g. 23 → "NNE"). */
export function compassPoint(bearing: number): CompassPoint {
  const i = Math.round(normalizeDeg(bearing) / 22.5) % 16
  return COMPASS_16[i]!
}
