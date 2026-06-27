import Link from 'next/link'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { ScreenHeader } from '@/components/shell/screen-header'
import { formatZarRounded } from '@/components/travel/format'
import { nextTripCountdown, type CountdownTrip } from '@/components/travel/countdown'
import {
  TRIP_STATUSES,
  TRIP_STATUS_LABELS,
  type TripRow,
  type TripStatus,
} from '@/components/travel/map'

/** Short "8–14 Jul" style range from ISO dates, JHB locale. */
const dayMonthFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Africa/Johannesburg',
})
const dayFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: 'numeric',
  timeZone: 'Africa/Johannesburg',
})
const monthFormatter = new Intl.DateTimeFormat('en-ZA', {
  month: 'short',
  timeZone: 'Africa/Johannesburg',
})

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "8–14 Jul" when same month, "28 Jun – 3 Jul" across months, else a single date. */
function formatRange(start: string | null, end: string | null): string {
  const s = parse(start)
  const e = parse(end)
  if (!s) return 'No dates yet'
  if (!e) return dayMonthFormatter.format(s)
  const sameMonth = monthFormatter.format(s) === monthFormatter.format(e)
  if (sameMonth) {
    return `${dayFormatter.format(s)}–${dayFormatter.format(e)} ${monthFormatter.format(e)}`
  }
  return `${dayMonthFormatter.format(s)} – ${dayMonthFormatter.format(e)}`
}

/** Month label for a planning row, e.g. "Sep". */
function monthLabel(iso: string | null): string | null {
  const d = parse(iso)
  return d ? monthFormatter.format(d) : null
}

export default async function TravelPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: tripRows } = await supabase
    .from('trips')
    .select(
      'id, household_id, name, destination, start_date, end_date, status, budget_total, cover_image_drive_file_id',
    )
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('start_date', { ascending: true, nullsFirst: false })
    .returns<TripRow[]>()

  const trips = tripRows ?? []

  // Real countdown helper drives the hero.
  const countdownTrips: CountdownTrip[] = trips.map((t) => ({
    name: t.name,
    startDate: t.start_date,
    status: t.status,
  }))
  const countdown = nextTripCountdown(countdownTrips)

  // The full row that backs the countdown (for destination / budget / status).
  const heroTrip = countdown
    ? (trips.find(
        (t) => t.name === countdown.tripName && t.start_date?.slice(0, 10) === countdown.startDate,
      ) ?? null)
    : null

  // Trips grouped by status (real data) for the planning list.
  const grouped = new Map<TripStatus, TripRow[]>()
  for (const status of TRIP_STATUSES) grouped.set(status, [])
  for (const t of trips) grouped.get(t.status)?.push(t)

  const newTripPill = (
    <Link
      href="/travel/new"
      className="inline-flex items-center rounded-full bg-terracotta-400 px-4 py-2 text-[13px] font-semibold text-cream-50 shadow-sm transition-colors hover:bg-terracotta-500"
    >
      New trip
    </Link>
  )

  const hasPlanning = TRIP_STATUSES.some((s) => (grouped.get(s) ?? []).length > 0)

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Travel" action={newTripPill} />

        {/* Next-trip hero — sage, white. Hidden gracefully when nothing upcoming. */}
        {countdown && heroTrip && (
          <section className="rounded-[22px] bg-sage-700 p-[18px] text-cream-50">
            <p className="text-[11px] font-semibold tracking-[0.07em] text-sage-200 uppercase">
              Next trip &middot; {TRIP_STATUS_LABELS[heroTrip.status]}
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-serif text-[28px] leading-tight font-semibold break-words">
                  {heroTrip.destination || heroTrip.name}
                </h2>
                <p className="mt-1 text-[13px] text-sage-100">
                  {formatRange(heroTrip.start_date, heroTrip.end_date)}
                  {heroTrip.budget_total != null
                    ? ` · ${formatZarRounded(heroTrip.budget_total)} budget`
                    : ''}
                </p>
              </div>
              <div className="shrink-0 text-right leading-none">
                <p className="font-serif text-[40px] font-semibold">{countdown.days}</p>
                <p className="mt-1 text-[12px] text-sage-200">
                  {countdown.days === 1 ? 'day away' : 'days away'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Planning list — rows from real trips grouped by status. */}
        {hasPlanning && (
          <div className="mt-6">
            <h3 className="px-1 text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
              Planning
            </h3>
            <div className="mt-2 space-y-3">
              {TRIP_STATUSES.map((status) => {
                const list = grouped.get(status) ?? []
                return list.map((trip) => {
                  const month = monthLabel(trip.start_date)
                  const meta = [month, TRIP_STATUS_LABELS[status].toLowerCase()]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <Link
                      key={trip.id}
                      href={`/travel/${trip.id}`}
                      className="flex items-center justify-between gap-4 rounded-[16px] border border-cream-300 bg-cream-50 px-[18px] py-[14px] transition-colors hover:bg-cream-100"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-terracotta-900">
                          {trip.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#8a7163]">
                          {trip.destination ? `${trip.destination} · ${meta}` : meta}
                        </p>
                      </div>
                      {trip.budget_total != null && (
                        <span className="shrink-0 text-[14px] font-semibold text-sage-500">
                          {formatZarRounded(trip.budget_total)}
                        </span>
                      )}
                    </Link>
                  )
                })
              })}
            </div>
          </div>
        )}

        {/* Empty state — no trips at all. */}
        {trips.length === 0 && (
          <div className="mt-6 rounded-[16px] border border-cream-300 bg-cream-50 px-[18px] py-8 text-center">
            <p className="font-serif text-[18px] font-semibold text-terracotta-900">
              Let&apos;s plan your first trip
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-[#8a7163]">
              Capture a trip idea, then build out its itinerary, budget, packing lists and
              travel documents as the plan firms up.
            </p>
            <div className="mt-4 flex justify-center">{newTripPill}</div>
          </div>
        )}
      </div>
    </main>
  )
}
