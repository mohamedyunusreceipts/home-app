import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatZarRounded } from '@/components/travel/format'
import { TRIP_STATUS_LABELS } from '@/components/travel/map'
import type {
  TripRow,
  ItineraryItemRow,
  TripExpenseRow,
  PackingListRow,
  PackingItemRow,
  TripDocRow,
  TripOutfitRow,
  TripNoteRow,
} from '@/components/travel/map'
import { TripDetail } from '@/components/travel/trip-detail'

export default async function TripDetailPage({
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

  const [
    { data: itinerary },
    { data: expenses },
    { data: packingLists },
    { data: docs },
    { data: outfits },
    { data: note },
    { data: memberRows },
  ] = await Promise.all([
    supabase
      .from('trip_itinerary_items')
      .select('id, trip_id, day, time, title, location, notes, attachment_drive_file_id')
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .order('day', { ascending: true })
      .order('time', { ascending: true, nullsFirst: true })
      .returns<ItineraryItemRow[]>(),
    supabase
      .from('trip_expenses')
      .select('id, trip_id, date, amount, category, description, also_count_in_monthly_budget')
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .returns<TripExpenseRow[]>(),
    supabase
      .from('packing_lists')
      .select('id, trip_id, name')
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .returns<PackingListRow[]>(),
    supabase
      .from('trip_docs')
      .select('id, trip_id, kind, drive_file_id, expiry_date')
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .order('kind', { ascending: true })
      .returns<TripDocRow[]>(),
    supabase
      .from('trip_outfits')
      .select('id, trip_id, day, wardrobe_item_ids')
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .order('day', { ascending: true })
      .returns<TripOutfitRow[]>(),
    supabase
      .from('trip_notes')
      .select('id, trip_id, body_md')
      .eq('trip_id', tripId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<TripNoteRow>(),
    supabase
      .from('profiles')
      .select('id, display_name, email')
      .returns<{ id: string; display_name: string | null; email: string }[]>(),
  ])

  const listIds = (packingLists ?? []).map((l) => l.id)
  let packingItems: PackingItemRow[] = []
  if (listIds.length > 0) {
    const { data: itemRows } = await supabase
      .from('packing_items')
      .select('id, list_id, name, packed_by_user_id, packed')
      .in('list_id', listIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .returns<PackingItemRow[]>()
    packingItems = itemRows ?? []
  }

  const members = (memberRows ?? []).map((m) => ({
    id: m.id,
    label: m.display_name ?? m.email,
  }))

  return (
    <main className="min-h-screen p-8 pb-28">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <Link href="/travel" className="text-sm text-sage-600 hover:text-terracotta-700">
            ← Back to trips
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-3xl text-terracotta-700">{trip.name}</h1>
              <p className="text-sage-600">
                {trip.destination ? `${trip.destination} · ` : ''}
                {TRIP_STATUS_LABELS[trip.status]}
                {trip.start_date ? ` · ${formatDate(trip.start_date)}` : ''}
                {trip.end_date ? ` – ${formatDate(trip.end_date)}` : ''}
                {trip.budget_total != null
                  ? ` · ${formatZarRounded(trip.budget_total)} budget`
                  : ''}
              </p>
            </div>
            <Link href={`/travel/${trip.id}/edit`}>
              <Button variant="outline">Edit trip</Button>
            </Link>
          </div>
        </header>

        <TripDetail
          tripId={trip.id}
          members={members}
          itinerary={itinerary ?? []}
          expenses={expenses ?? []}
          budgetTotal={trip.budget_total}
          packingLists={packingLists ?? []}
          packingItems={packingItems}
          docs={docs ?? []}
          outfits={outfits ?? []}
          note={note ?? null}
        />
      </div>
    </main>
  )
}
