import { describe, it, expect } from 'vitest'
import {
  qiblaBearing,
  distanceToKaabaKm,
  compassPoint,
  normalizeDeg,
  KAABA,
} from '@/lib/qibla/compute'

describe('qiblaBearing', () => {
  // Reference bearings cross-checked against published Qibla directions.
  const cases: { city: string; lat: number; lng: number; bearing: number }[] = [
    { city: 'London', lat: 51.5074, lng: -0.1278, bearing: 118.99 },
    { city: 'New York', lat: 40.7128, lng: -74.006, bearing: 58.48 },
    { city: 'Cape Town', lat: -33.9249, lng: 18.4241, bearing: 23.35 },
    { city: 'Jakarta', lat: -6.2088, lng: 106.8456, bearing: 295.15 },
  ]

  for (const c of cases) {
    it(`${c.city} points ${c.bearing}° from true North`, () => {
      expect(qiblaBearing(c.lat, c.lng)).toBeCloseTo(c.bearing, 1)
    })
  }

  it('always returns a bearing in [0, 360)', () => {
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lng = -180; lng <= 180; lng += 30) {
        const b = qiblaBearing(lat, lng)
        expect(b).toBeGreaterThanOrEqual(0)
        expect(b).toBeLessThan(360)
      }
    }
  })
})

describe('distanceToKaabaKm', () => {
  it('is ~0 at the Kaaba itself', () => {
    expect(distanceToKaabaKm(KAABA.lat, KAABA.lng)).toBeCloseTo(0, 3)
  })

  it('matches known great-circle distances (±5 km)', () => {
    expect(distanceToKaabaKm(51.5074, -0.1278)).toBeCloseTo(4794, -1) // London
    expect(distanceToKaabaKm(-33.9249, 18.4241)).toBeCloseTo(6558, -1) // Cape Town
  })
})

describe('compassPoint', () => {
  it('maps cardinal and intercardinal bearings', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(45)).toBe('NE')
    expect(compassPoint(90)).toBe('E')
    expect(compassPoint(180)).toBe('S')
    expect(compassPoint(270)).toBe('W')
    expect(compassPoint(360)).toBe('N')
  })

  it('rounds to the nearest 16-point label', () => {
    expect(compassPoint(23.35)).toBe('NNE') // Cape Town's Qibla
    expect(compassPoint(119)).toBe('ESE') // London's Qibla
  })
})

describe('normalizeDeg', () => {
  it('wraps negatives and overflow into [0, 360)', () => {
    expect(normalizeDeg(-10)).toBe(350)
    expect(normalizeDeg(370)).toBe(10)
    expect(normalizeDeg(720)).toBe(0)
  })
})
