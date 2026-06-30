'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useShell } from '@/components/shell/shell-context'
import { PushToggle } from '@/components/shell/push-toggle'
import {
  PRESET_LOCATIONS,
  METHODS,
  MADHABS,
  NOTIFIABLE_PRAYERS,
  computePrayerTimes,
  nextPrayerAcrossDays,
  type ComputedTimes,
  type PrayerName,
  type NotifiablePrayer,
} from '@/lib/salaah/compute'
import { saveSalaahSettings } from './actions'

export interface SalaahSettings {
  latitude: number
  longitude: number
  locationName: string
  timezone: string
  method: string
  madhab: string
  pushEnabled: boolean
  prayers: Record<NotifiablePrayer, boolean>
}

const PRAYER_ROWS: { key: PrayerName; label: string; notifiable: boolean }[] = [
  { key: 'fajr', label: 'Fajr', notifiable: true },
  { key: 'sunrise', label: 'Sunrise', notifiable: false },
  { key: 'dhuhr', label: 'Dhuhr', notifiable: true },
  { key: 'asr', label: 'Asr', notifiable: true },
  { key: 'maghrib', label: 'Maghrib', notifiable: true },
  { key: 'isha', label: 'Isha', notifiable: true },
]

const NOTIFIABLE_LABEL: Record<NotifiablePrayer, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

/** Build a time formatter pinned to the location's timezone. */
function timeFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })
}

/** Format a millisecond gap as "2h 14m" / "14m 06s" for the live countdown. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

export function SalaahClient({ initial }: { initial: SalaahSettings }) {
  const { showToast } = useShell()
  const [pending, startTransition] = useTransition()

  const [lat, setLat] = useState(initial.latitude)
  const [lng, setLng] = useState(initial.longitude)
  const [locationName, setLocationName] = useState(initial.locationName)
  const [timezone, setTimezone] = useState(initial.timezone)
  const [method, setMethod] = useState(initial.method)
  const [madhab, setMadhab] = useState(initial.madhab)
  const [pushEnabled, setPushEnabled] = useState(initial.pushEnabled)
  const [prayers, setPrayers] = useState<Record<NotifiablePrayer, boolean>>(initial.prayers)

  // Live "now" tick (every second) for the countdown. Initialised on mount to
  // avoid a hydration mismatch (server and client clocks differ).
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    // Defer the first tick (don't setState synchronously in the effect body).
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [])

  // Which preset (if any) matches the current coords — drives the <select>.
  const selectedPresetIndex = useMemo(() => {
    const i = PRESET_LOCATIONS.findIndex(
      (p) => Math.abs(p.lat - lat) < 1e-4 && Math.abs(p.lng - lng) < 1e-4,
    )
    return i
  }, [lat, lng])

  // Today's times for the selected location/method/madhab. Computed against the
  // current clock so it follows the user across midnight; recomputes when inputs
  // change. We pass `now ?? new Date()` so SSR/first paint still renders times.
  const times: ComputedTimes = useMemo(
    () =>
      computePrayerTimes({
        lat,
        lng,
        methodKey: method,
        madhabKey: madhab,
        date: now ?? new Date(),
      }),
    [lat, lng, method, madhab, now],
  )

  const next = useMemo(
    () =>
      nextPrayerAcrossDays({
        lat,
        lng,
        methodKey: method,
        madhabKey: madhab,
        now: now ?? new Date(),
      }),
    [lat, lng, method, madhab, now],
  )

  const fmt = useMemo(() => timeFormatter(timezone), [timezone])

  function handlePresetChange(value: string) {
    const idx = Number(value)
    const preset = PRESET_LOCATIONS[idx]
    if (!preset) return
    setLat(preset.lat)
    setLng(preset.lng)
    setLocationName(preset.name)
    setTimezone(preset.timezone)
  }

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
        try {
          setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
        } catch {
          // keep existing timezone
        }
        showToast('Using your current location.')
      },
      () => showToast('Could not get your location.'),
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }, [showToast])

  function togglePrayer(key: NotifiablePrayer) {
    setPrayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveSalaahSettings({
        latitude: lat,
        longitude: lng,
        locationName,
        timezone,
        method,
        madhab,
        pushEnabled,
        prayers,
      })
      if ('error' in result) {
        showToast(result.error)
      } else {
        showToast('Salaah settings saved')
      }
    })
  }

  const countdownMs = now ? next.time.getTime() - now.getTime() : 0

  return (
    <div className="space-y-3">
      {/* Next prayer + countdown — terracotta hero. */}
      <section className="rounded-[22px] bg-[#C77B5C] p-[18px] text-cream-50">
        <p className="text-[11px] font-semibold tracking-[0.07em] text-cream-50/85 uppercase">
          Next prayer
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <p className="font-serif text-[clamp(28px,9vw,38px)] font-semibold leading-none">
            {NOTIFIABLE_LABEL[next.name]}
          </p>
          <p className="font-serif text-[clamp(22px,7vw,30px)] font-semibold leading-none tabular-nums">
            {fmt.format(next.time)}
          </p>
        </div>
        <p className="mt-2 text-[13px] text-cream-50/90 tabular-nums">
          {now ? `in ${formatCountdown(countdownMs)}` : 'Calculating…'}
          {' · '}
          {locationName}
        </p>
      </section>

      {/* Today's times. */}
      <section className="rounded-[20px] border border-cream-300 bg-cream-50 p-[18px]">
        <h2 className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
          Today&apos;s times
        </h2>
        <ul className="mt-3 divide-y divide-[#F2EBDF]">
          {PRAYER_ROWS.map((row) => {
            const isNext = row.notifiable && row.key === next.name
            return (
              <li
                key={row.key}
                className={`flex items-center justify-between py-2.5 ${
                  isNext ? '-mx-2 rounded-[12px] bg-[#FBF2EE] px-2' : ''
                }`}
              >
                <span
                  className={`text-[15px] ${
                    isNext
                      ? 'font-semibold text-[#793F2D]'
                      : row.notifiable
                        ? 'font-medium text-terracotta-900'
                        : 'font-medium text-[#8a7163]'
                  }`}
                >
                  {row.label}
                </span>
                <span
                  className={`text-[15px] tabular-nums ${
                    isNext ? 'font-semibold text-[#793F2D]' : 'text-[#8a7163]'
                  }`}
                >
                  {fmt.format(times[row.key])}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Location. */}
      <section className="rounded-[20px] border border-cream-300 bg-cream-50 p-[18px]">
        <h2 className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
          Location
        </h2>
        <label className="mt-3 block">
          <span className="sr-only">Preset location</span>
          <select
            value={selectedPresetIndex >= 0 ? String(selectedPresetIndex) : ''}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full rounded-[12px] border border-cream-300 bg-white px-3 py-2.5 text-[15px] text-terracotta-900"
          >
            {selectedPresetIndex < 0 ? (
              <option value="">{locationName}</option>
            ) : null}
            {PRESET_LOCATIONS.map((p, i) => (
              <option key={p.name} value={String(i)}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={useMyLocation}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-4 py-2 text-[13px] font-semibold text-sage-600 transition-colors hover:bg-cream-100"
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
          Use my current location
        </button>
      </section>

      {/* Method + Madhab. */}
      <section className="rounded-[20px] border border-cream-300 bg-cream-50 p-[18px]">
        <h2 className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
          Calculation
        </h2>
        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-[#8a7163]">Method</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1 w-full rounded-[12px] border border-cream-300 bg-white px-3 py-2.5 text-[15px] text-terracotta-900"
          >
            {Object.entries(METHODS).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-[#8a7163]">Madhab (affects Asr)</span>
          <select
            value={madhab}
            onChange={(e) => setMadhab(e.target.value)}
            className="mt-1 w-full rounded-[12px] border border-cream-300 bg-white px-3 py-2.5 text-[15px] text-terracotta-900"
          >
            {Object.entries(MADHABS).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Push notifications. */}
      <section className="rounded-[20px] border border-cream-300 bg-cream-50 p-[18px]">
        <h2 className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
          Notifications
        </h2>

        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-terracotta-900">Browser push</p>
            <p className="text-[12px] text-[#8a7163]">Allow push on this device</p>
          </div>
          <PushToggle />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#F2EBDF] pt-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-terracotta-900">Salaah reminders</p>
            <p className="text-[12px] text-[#8a7163]">Notify at each prayer time</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pushEnabled}
            aria-label="Salaah reminders"
            onClick={() => setPushEnabled((v) => !v)}
            className="relative inline-flex h-[30px] w-[52px] shrink-0 items-center rounded-full px-[3px] transition-colors"
            style={{ backgroundColor: pushEnabled ? '#7A9B7A' : '#DBCFB7' }}
          >
            <span
              className="h-[24px] w-[24px] rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: pushEnabled ? 'translateX(22px)' : 'translateX(0)' }}
            />
          </button>
        </div>

        <fieldset
          className={`mt-4 border-t border-[#F2EBDF] pt-4 transition-opacity ${
            pushEnabled ? '' : 'opacity-50'
          }`}
          disabled={!pushEnabled}
        >
          <legend className="text-[12px] font-medium text-[#8a7163]">Which prayers</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {NOTIFIABLE_PRAYERS.map((p) => (
              <label
                key={p}
                className="flex items-center gap-2.5 rounded-[12px] border border-cream-300 bg-white px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={prayers[p]}
                  onChange={() => togglePrayer(p)}
                  className="size-[18px] accent-[#7A9B7A]"
                />
                <span className="text-[14px] font-medium text-terracotta-900">
                  {NOTIFIABLE_LABEL[p]}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[#8a7163]">
            Reminders need browser push enabled above.
          </p>
        </fieldset>
      </section>

      {/* Save. */}
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="w-full rounded-full bg-terracotta-400 px-4 py-3 text-[15px] font-semibold text-cream-50 shadow-sm transition-colors hover:bg-terracotta-500 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  )
}
