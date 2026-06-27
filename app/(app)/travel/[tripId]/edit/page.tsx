import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { TripForm } from '@/components/travel/trip-form'
import { DeleteTripButton } from '@/components/travel/delete-trip-button'
import type { TripRow } from '@/components/travel/map'

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = await params
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select(
      'id, household_id, name, destination, start_date, end_date, status, budget_total, cover_image_drive_file_id',
    )
    .eq('id', tripId)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .maybeSingle<TripRow>()

  if (!trip) notFound()

  return (
    <main className="min-h-screen p-8 pb-28">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <Link
            href={`/travel/${trip.id}`}
            className="text-sm text-sage-600 hover:text-terracotta-700"
          >
            ← Back to trip
          </Link>
          <h1 className="font-serif text-3xl text-terracotta-700">Edit trip</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Trip details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <TripForm trip={trip} />
            <DeleteTripButton tripId={trip.id} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
