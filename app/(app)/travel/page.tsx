import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatZarRounded } from '@/components/travel/format'
import { nextTripCountdown, type CountdownTrip } from '@/components/travel/countdown'
import {
  TRIP_STATUSES,
  TRIP_STATUS_LABELS,
  type TripRow,
  type TripStatus,
} from '@/components/travel/map'

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

  const countdownTrips: CountdownTrip[] = trips.map((t) => ({
    name: t.name,
    startDate: t.start_date,
    status: t.status,
  }))
  const countdown = nextTripCountdown(countdownTrips)

  const grouped = new Map<TripStatus, TripRow[]>()
  for (const status of TRIP_STATUSES) grouped.set(status, [])
  for (const t of trips) grouped.get(t.status)?.push(t)

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-terracotta-700">Travel &amp; packing</h1>
            <p className="text-sage-600">Plan trips end to end — ideas to itinerary.</p>
          </div>
          <Link href="/travel/new">
            <Button>New trip</Button>
          </Link>
        </header>

        {countdown && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-terracotta-700">Next trip</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-serif text-3xl font-semibold text-terracotta-700">
                {countdown.days} {countdown.days === 1 ? 'day' : 'days'}
              </p>
              <p className="text-sage-600">
                until {countdown.tripName} ({formatDate(countdown.startDate)})
              </p>
            </CardContent>
          </Card>
        )}

        {trips.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-terracotta-700">
                Let&apos;s plan your first trip
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sage-800">
              <p>
                Capture a trip idea, then build out its itinerary, budget, packing
                lists and travel documents as the plan firms up.
              </p>
              <Link href="/travel/new">
                <Button>New trip</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {TRIP_STATUSES.map((status) => {
          const list = grouped.get(status) ?? []
          if (list.length === 0) return null
          return (
            <section key={status} className="space-y-3">
              <h2 className="font-serif text-xl text-sage-800">
                {TRIP_STATUS_LABELS[status]}
              </h2>
              <div className="space-y-2">
                {list.map((trip) => (
                  <Link key={trip.id} href={`/travel/${trip.id}`} className="block">
                    <Card>
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium text-sage-900">{trip.name}</p>
                          <p className="text-sm text-sage-600">
                            {trip.destination ? `${trip.destination} · ` : ''}
                            {trip.start_date ? formatDate(trip.start_date) : 'No dates yet'}
                            {trip.end_date ? ` – ${formatDate(trip.end_date)}` : ''}
                          </p>
                        </div>
                        {trip.budget_total != null && (
                          <span className="text-sm text-sage-700">
                            {formatZarRounded(trip.budget_total)}
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
