'use server'

import { revalidatePath } from 'next/cache'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { TRIP_DOC_KINDS, type TripDocKind } from '@/components/travel/map'

export type ActionResult = { error: string } | { success: true }

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function num(formData: FormData, key: string): number | null {
  const raw = str(formData, key)
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Confirm the trip belongs to the caller's household; returns it or null. */
async function ownedTripId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  tripId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>()
  return data?.id ?? null
}

// ── Itinerary ───────────────────────────────────────────────────────────────

export async function addItineraryItemAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const tripId = str(formData, 'trip_id')
  if (!(await ownedTripId(supabase, householdId, tripId)))
    return { error: 'Trip not found.' }

  const day = str(formData, 'day')
  const title = str(formData, 'title')
  if (!day) return { error: 'Please choose a day.' }
  if (!title) return { error: 'Please enter a title.' }

  const { error } = await supabase.from('trip_itinerary_items').insert({
    household_id: householdId,
    trip_id: tripId,
    day,
    time: str(formData, 'time') || null,
    title,
    location: str(formData, 'location') || null,
    notes: str(formData, 'notes') || null,
    attachment_drive_file_id: str(formData, 'drive_file_id') || null,
  })
  if (error) return { error: error.message }
  revalidatePath(`/travel/${tripId}`)
  return { success: true }
}

export async function deleteItineraryItemAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const id = str(formData, 'id')
  const tripId = str(formData, 'trip_id')
  if (!id) return
  await supabase
    .from('trip_itinerary_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)
  revalidatePath(`/travel/${tripId}`)
}

// ── Expenses ──────────────────────────────────────────────────────────────

export async function addExpenseAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const tripId = str(formData, 'trip_id')
  if (!(await ownedTripId(supabase, householdId, tripId)))
    return { error: 'Trip not found.' }

  const date = str(formData, 'date')
  const amount = num(formData, 'amount')
  if (!date) return { error: 'Please choose a date.' }
  if (amount == null || amount < 0) return { error: 'Please enter a valid amount.' }

  const { error } = await supabase.from('trip_expenses').insert({
    household_id: householdId,
    trip_id: tripId,
    date,
    amount,
    category: str(formData, 'category') || null,
    description: str(formData, 'description') || null,
    also_count_in_monthly_budget: formData.get('also_count_in_monthly_budget') === 'on',
  })
  if (error) return { error: error.message }
  revalidatePath(`/travel/${tripId}`)
  return { success: true }
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const id = str(formData, 'id')
  const tripId = str(formData, 'trip_id')
  if (!id) return
  await supabase
    .from('trip_expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)
  revalidatePath(`/travel/${tripId}`)
}

// ── Packing lists & items ────────────────────────────────────────────────────

export async function addPackingListAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const tripId = str(formData, 'trip_id')
  if (!(await ownedTripId(supabase, householdId, tripId)))
    return { error: 'Trip not found.' }

  const name = str(formData, 'name')
  if (!name) return { error: 'Please name the list.' }

  const { error } = await supabase
    .from('packing_lists')
    .insert({ household_id: householdId, trip_id: tripId, name })
  if (error) return { error: error.message }
  revalidatePath(`/travel/${tripId}`)
  return { success: true }
}

export async function addPackingItemAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const tripId = str(formData, 'trip_id')
  const listId = str(formData, 'list_id')
  const name = str(formData, 'name')
  if (!listId) return { error: 'Missing list.' }
  if (!name) return { error: 'Please enter an item.' }

  // Ownership is enforced by RLS; we still scope the household_id explicitly.
  const { error } = await supabase
    .from('packing_items')
    .insert({ household_id: householdId, list_id: listId, name })
  if (error) return { error: error.message }
  revalidatePath(`/travel/${tripId}`)
  return { success: true }
}

/** Toggle an item's packed flag. Stamps packed_by to the current user when packing. */
export async function togglePackedAction(formData: FormData): Promise<void> {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()
  const id = str(formData, 'id')
  const tripId = str(formData, 'trip_id')
  const packed = formData.get('packed') === 'true'
  if (!id) return
  await supabase
    .from('packing_items')
    .update({
      packed,
      packed_by_user_id: packed ? user.id : null,
    })
    .eq('id', id)
    .eq('household_id', householdId)
  revalidatePath(`/travel/${tripId}`)
}

export async function deletePackingItemAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const id = str(formData, 'id')
  const tripId = str(formData, 'trip_id')
  if (!id) return
  await supabase
    .from('packing_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)
  revalidatePath(`/travel/${tripId}`)
}

// ── Travel documents ─────────────────────────────────────────────────────────

function asDocKind(raw: string): TripDocKind {
  return (TRIP_DOC_KINDS as readonly string[]).includes(raw)
    ? (raw as TripDocKind)
    : 'other'
}

/**
 * Save a travel-document metadata row. The Drive binary (if any) is uploaded
 * separately via /api/drive/upload (Travel module, per-trip subcategory); when
 * Drive is not connected the upload returns 409 and the form simply saves the row
 * without a drive_file_id, so the file can be attached later.
 */
export async function addTripDocAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const tripId = str(formData, 'trip_id')
  if (!(await ownedTripId(supabase, householdId, tripId)))
    return { error: 'Trip not found.' }

  const { error } = await supabase.from('trip_docs').insert({
    household_id: householdId,
    trip_id: tripId,
    kind: asDocKind(str(formData, 'kind')),
    drive_file_id: str(formData, 'drive_file_id') || null,
    expiry_date: str(formData, 'expiry_date') || null,
  })
  if (error) return { error: error.message }
  revalidatePath(`/travel/${tripId}`)
  return { success: true }
}

export async function deleteTripDocAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const id = str(formData, 'id')
  const tripId = str(formData, 'trip_id')
  if (!id) return
  await supabase
    .from('trip_docs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)
  revalidatePath(`/travel/${tripId}`)
}

// ── Notes ─────────────────────────────────────────────────────────────────

/** Upsert the trip's single notes row (one body_md per trip in this UI). */
export async function saveTripNotesAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const tripId = str(formData, 'trip_id')
  if (!(await ownedTripId(supabase, householdId, tripId)))
    return { error: 'Trip not found.' }

  const bodyMd = String(formData.get('body_md') ?? '')
  const noteId = str(formData, 'note_id')

  if (noteId) {
    const { error } = await supabase
      .from('trip_notes')
      .update({ body_md: bodyMd })
      .eq('id', noteId)
      .eq('household_id', householdId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('trip_notes')
      .insert({ household_id: householdId, trip_id: tripId, body_md: bodyMd })
    if (error) return { error: error.message }
  }
  revalidatePath(`/travel/${tripId}`)
  return { success: true }
}

// ── Outfit packing plan ──────────────────────────────────────────────────────

/**
 * Assign wardrobe item ids to a trip day. Cross-module link is by uuid[] ONLY —
 * the wardrobe module owns those rows; we never import it or FK to it (spec §9.5/§9.6).
 * Item ids are entered as a comma/space-separated list of UUIDs.
 */
export async function saveOutfitAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const tripId = str(formData, 'trip_id')
  if (!(await ownedTripId(supabase, householdId, tripId)))
    return { error: 'Trip not found.' }

  const day = str(formData, 'day')
  if (!day) return { error: 'Please choose a day.' }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const ids = str(formData, 'wardrobe_item_ids')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const invalid = ids.filter((id) => !UUID_RE.test(id))
  if (invalid.length > 0)
    return { error: `Not valid wardrobe item ids: ${invalid.join(', ')}` }

  const { error } = await supabase
    .from('trip_outfits')
    .insert({
      household_id: householdId,
      trip_id: tripId,
      day,
      wardrobe_item_ids: ids,
    })
  if (error) return { error: error.message }
  revalidatePath(`/travel/${tripId}`)
  return { success: true }
}

export async function deleteOutfitAction(formData: FormData): Promise<void> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const id = str(formData, 'id')
  const tripId = str(formData, 'trip_id')
  if (!id) return
  await supabase
    .from('trip_outfits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)
  revalidatePath(`/travel/${tripId}`)
}
