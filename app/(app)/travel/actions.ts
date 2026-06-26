'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { travelTripPath } from '@/lib/drive/folders'
import { TRIP_STATUSES, type TripStatus } from '@/components/travel/map'

export type TripResult = { error: string } | { success: true; tripId: string }

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function num(formData: FormData, key: string): number | null {
  const raw = str(formData, key)
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function asStatus(raw: string): TripStatus {
  return (TRIP_STATUSES as readonly string[]).includes(raw)
    ? (raw as TripStatus)
    : 'idea'
}

/**
 * Create or edit a trip. On create we ALSO compute the canonical Drive folder path
 * (`/HomeApp/Travel/<TripId>-<TripNameSlug>/`, spec §5.4) and cache it — actual
 * folder creation is gated behind the DriveClient, so we only persist metadata.
 * The path is recorded best-effort and never blocks the trip create.
 */
export async function upsertTripAction(formData: FormData): Promise<TripResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const id = str(formData, 'id')
  const name = str(formData, 'name')
  const destination = str(formData, 'destination')
  const startDate = str(formData, 'start_date')
  const endDate = str(formData, 'end_date')
  const status = asStatus(str(formData, 'status'))
  const budgetTotal = num(formData, 'budget_total')

  if (!name) return { error: 'Please give the trip a name.' }
  if (startDate && endDate && endDate < startDate) {
    return { error: 'The end date cannot be before the start date.' }
  }

  const payload = {
    household_id: householdId,
    name,
    destination: destination || null,
    start_date: startDate || null,
    end_date: endDate || null,
    status,
    budget_total: budgetTotal,
  }

  if (id) {
    const { error } = await supabase.from('trips').update(payload).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/travel')
    revalidatePath(`/travel/${id}`)
    return { success: true, tripId: id }
  }

  const { data, error } = await supabase
    .from('trips')
    .insert(payload)
    .select('id')
    .single<{ id: string }>()
  if (error || !data) return { error: error?.message ?? 'Could not create the trip.' }

  // The trip's canonical Drive folder path (spec §5.4) is fully derivable from the
  // trip id + name, so there's nothing to persist here: it's computed on demand
  // (see travelTripPath) and the folder is lazily created the first time a file is
  // uploaded into it via /api/drive/upload + the FolderResolver. We compute it once
  // to keep the dependency explicit and to fail fast on a bad slug.
  void travelTripPath(data.id, name)

  revalidatePath('/travel')
  return { success: true, tripId: data.id }
}

/** Soft-delete a trip. */
export async function deleteTripAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const id = str(formData, 'id')
  if (!id) return
  await supabase
    .from('trips')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)
  revalidatePath('/travel')
  redirect('/travel')
}
