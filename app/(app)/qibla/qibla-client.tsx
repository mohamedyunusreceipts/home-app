'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useShell } from '@/components/shell/shell-context'
import {
  qiblaBearing,
  distanceToKaabaKm,
  compassPoint,
  normalizeDeg,
} from '@/lib/qibla/compute'

export interface QiblaLocation {
  latitude: number
  longitude: number
  locationName: string
}

/** iOS exposes a true-north heading directly on the orientation event. */
interface WebkitOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
}

/** iOS 13+ gates the sensor behind a per-gesture permission prompt. */
interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

type Permission = 'idle' | 'granted' | 'denied' | 'unsupported'

// ── SVG dial geometry ──────────────────────────────────────────────────────
const SIZE = 280
const C = SIZE / 2 // centre
const RING_R = 120 // cardinal-label radius
const MARK_R = 104 // Kaaba marker radius

function pointAt(angleDeg: number, radius: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180
  return { x: C + radius * Math.sin(a), y: C - radius * Math.cos(a) }
}

export function QiblaClient({ initial }: { initial: QiblaLocation }) {
  const { showToast } = useShell()

  const [lat, setLat] = useState(initial.latitude)
  const [lng, setLng] = useState(initial.longitude)
  const [locationName, setLocationName] = useState(initial.locationName)

  const [heading, setHeading] = useState<number | null>(null)
  const [permission, setPermission] = useState<Permission>('idle')
  const wasAligned = useRef(false)

  const bearing = useMemo(() => qiblaBearing(lat, lng), [lat, lng])
  const distanceKm = useMemo(() => distanceToKaabaKm(lat, lng), [lat, lng])
  const point = useMemo(() => compassPoint(bearing), [bearing])

  const isLive = heading != null
  // Clockwise offset from where the phone points to the Qibla.
  const delta = normalizeDeg(bearing - (heading ?? 0))
  const angleDiff = Math.min(delta, 360 - delta)
  const aligned = isLive && angleDiff <= 6

  // A single gentle buzz the moment we line up (not on every frame).
  useEffect(() => {
    if (aligned && !wasAligned.current) {
      wasAligned.current = true
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(35)
      }
    } else if (!aligned) {
      wasAligned.current = false
    }
  }, [aligned])

  // Attach the compass listeners once permission is granted. State is only set
  // inside the async event handler, never synchronously in the effect body.
  useEffect(() => {
    if (permission !== 'granted') return

    function handle(event: DeviceOrientationEvent) {
      const e = event as WebkitOrientationEvent
      let h: number | null = null
      if (typeof e.webkitCompassHeading === 'number') {
        h = e.webkitCompassHeading // iOS: already true-north, clockwise
      } else if (e.absolute && e.alpha != null) {
        h = 360 - e.alpha // Android absolute: alpha is counter-clockwise
      }
      if (h != null && !Number.isNaN(h)) setHeading(normalizeDeg(h))
    }

    window.addEventListener('deviceorientationabsolute', handle, true)
    window.addEventListener('deviceorientation', handle, true)
    return () => {
      window.removeEventListener('deviceorientationabsolute', handle, true)
      window.removeEventListener('deviceorientation', handle, true)
    }
  }, [permission])

  const enableCompass = useCallback(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) {
      setPermission('unsupported')
      showToast('This device has no compass sensor.')
      return
    }
    const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationEventStatic
    if (typeof DOE.requestPermission === 'function') {
      DOE.requestPermission()
        .then((res) => {
          setPermission(res === 'granted' ? 'granted' : 'denied')
          if (res !== 'granted') showToast('Compass permission was declined.')
        })
        .catch(() => setPermission('denied'))
    } else {
      // Android / desktop: no explicit permission needed.
      setPermission('granted')
    }
  }, [showToast])

  const useMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Location is not available on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setLocationName('My location')
        showToast('Using your current location.')
      },
      () => showToast('Could not get your location.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [showToast])

  const kaaba = pointAt(bearing, MARK_R)
  const accent = aligned ? '#5F8160' : '#C77B5C'

  const turnHint = !isLive
    ? null
    : aligned
      ? 'Facing the Qibla'
      : delta <= 180
        ? `Turn right ${Math.round(delta)}°`
        : `Turn left ${Math.round(360 - delta)}°`

  return (
    <div className="space-y-3">
      {/* Compass. */}
      <section className="rounded-[22px] border border-cream-300 bg-cream-50 p-[18px]">
        <div className="relative mx-auto w-full max-w-[300px]">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label={`Qibla is ${Math.round(bearing)} degrees, ${point}`}>
            {/* Outer plate. */}
            <circle cx={C} cy={C} r={130} fill="#FBF7EF" stroke="#E7DCC7" strokeWidth={1} />
            <circle cx={C} cy={C} r={RING_R + 6} fill="none" stroke="#EFE6D5" strokeWidth={1} />

            {/* Rotating dial: in live mode it counter-rotates so N tracks true
                North; in static mode it stays North-up. */}
            <g transform={`rotate(${-(heading ?? 0)} ${C} ${C})`}>
              {/* Degree ticks every 30°. */}
              {Array.from({ length: 12 }, (_, i) => {
                const a = i * 30
                const o = pointAt(a, RING_R + 4)
                const inr = pointAt(a, RING_R - 6)
                return (
                  <line
                    key={a}
                    x1={o.x}
                    y1={o.y}
                    x2={inr.x}
                    y2={inr.y}
                    stroke="#D8CBB2"
                    strokeWidth={a % 90 === 0 ? 2 : 1}
                  />
                )
              })}
              {/* Cardinal labels. */}
              {(
                [
                  ['N', 0, '#C77B5C'],
                  ['E', 90, '#8a7163'],
                  ['S', 180, '#8a7163'],
                  ['W', 270, '#8a7163'],
                ] as const
              ).map(([label, a, fill]) => {
                const p = pointAt(a, RING_R - 20)
                return (
                  <text
                    key={label}
                    x={p.x}
                    y={p.y}
                    fill={fill}
                    fontSize={16}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {label}
                  </text>
                )
              })}

              {/* Qibla needle + Kaaba marker. */}
              <line
                x1={C}
                y1={C}
                x2={kaaba.x}
                y2={kaaba.y}
                stroke={accent}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <circle cx={kaaba.x} cy={kaaba.y} r={16} fill={accent} />
              {/* Little Kaaba glyph. */}
              <rect
                x={kaaba.x - 6}
                y={kaaba.y - 5}
                width={12}
                height={10}
                rx={1.5}
                fill="#FBF7EF"
              />
              <rect x={kaaba.x - 6} y={kaaba.y - 5} width={12} height={3} fill={accent} />
            </g>

            {/* Fixed centre hub. */}
            <circle cx={C} cy={C} r={7} fill={accent} />
            <circle cx={C} cy={C} r={3} fill="#FBF7EF" />

            {/* Fixed top pointer (only meaningful when live) = phone facing. */}
            {isLive ? (
              <polygon
                points={`${C - 9},22 ${C + 9},22 ${C},6`}
                fill={accent}
              />
            ) : null}
          </svg>
        </div>

        {/* Read-out. */}
        <div className="mt-1 text-center">
          <p className="font-serif text-[34px] font-semibold leading-none text-terracotta-900 tabular-nums">
            {Math.round(bearing)}°{' '}
            <span className="text-[20px] text-[#8a7163]">{point}</span>
          </p>
          {turnHint ? (
            <p
              className="mt-2 text-[15px] font-semibold"
              style={{ color: aligned ? '#5F8160' : '#C77B5C' }}
            >
              {turnHint}
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-[#8a7163]">
              Dial is North-up. Enable the live compass to align by turning.
            </p>
          )}
        </div>

        {/* Compass enable / status. */}
        {!isLive ? (
          <button
            type="button"
            onClick={enableCompass}
            className="mt-3 w-full rounded-full bg-terracotta-400 px-4 py-3 text-[15px] font-semibold text-cream-50 shadow-sm transition-colors hover:bg-terracotta-500"
          >
            {permission === 'denied'
              ? 'Compass blocked — tap to retry'
              : permission === 'unsupported'
                ? 'No compass on this device'
                : 'Enable live compass'}
          </button>
        ) : null}
      </section>

      {/* Location. */}
      <section className="rounded-[20px] border border-cream-300 bg-cream-50 p-[18px]">
        <h2 className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
          Location
        </h2>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-terracotta-900">
              {locationName}
            </p>
            <p className="text-[12px] text-[#8a7163] tabular-nums">
              {Math.round(distanceKm).toLocaleString()} km to Makkah
            </p>
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-4 py-2 text-[13px] font-semibold text-sage-600 transition-colors hover:bg-cream-100"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.5-5.5l-2 2m-7 7l-2 2m11 0l-2-2m-7-7l-2-2" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
            My location
          </button>
        </div>
        <p className="mt-3 border-t border-[#F2EBDF] pt-3 text-[12px] text-[#8a7163]">
          Uses your{' '}
          <Link href="/salaah" className="font-semibold text-sage-600 hover:underline">
            Salaah location
          </Link>{' '}
          by default. For the live compass, hold your phone flat and away from
          metal or magnets. Heading may be off by a few degrees.
        </p>
      </section>
    </div>
  )
}
