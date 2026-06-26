'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import {
  WARDROBE_CATEGORIES,
  LAUNDRY_STATUSES,
  type WardrobeCategory,
  type LaundryStatus,
} from '@/components/wardrobe/types'

export type ActionResult = { error: string } | { success: true }

/** Split a comma-separated tag string into a clean string[]. */
function tags(formData: FormData, key: string): string[] {
  const raw = String(formData.get(key) ?? '')
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function isCategory(value: string): value is WardrobeCategory {
  return (WARDROBE_CATEGORIES as readonly string[]).includes(value)
}

function isLaundryStatus(value: string): value is LaundryStatus {
  return (LAUNDRY_STATUSES as readonly string[]).includes(value)
}

/**
 * Create or update a wardrobe item. The caller is always the owner — owner_user_id
 * is taken from the session, never from the form (RLS WITH CHECK enforces this too).
 * Underwear defaults to visible_to_partner=false (spec §9.6): when the category is
 * underwear and the user did not explicitly tick "share", we store false.
 */
export async function saveItemAction(formData: FormData): Promise<ActionResult> {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const id = str(formData, 'id')
  const category = str(formData, 'category')
  if (!isCategory(category)) return { error: 'Please choose a valid category.' }

  const color = str(formData, 'color')
  const brand = str(formData, 'brand')
  const size = str(formData, 'size')
  const notes = str(formData, 'notes')
  const photoDriveFileId = str(formData, 'photo_drive_file_id')
  const season = tags(formData, 'season')
  const occasion = tags(formData, 'occasion')

  // visible_to_partner reflects the share checkbox (absent from FormData when
  // unticked). The spec §9.6 underwear-private default is applied in the UI: the
  // item form pre-unticks the box for underwear, so a new underwear item saves
  // as private unless the user explicitly opts to share it.
  const visibleToPartner = formData.get('visible_to_partner') === 'on'

  const payload = {
    household_id: householdId,
    owner_user_id: user.id,
    category,
    color: color || null,
    brand: brand || null,
    size: size || null,
    notes: notes || null,
    photo_drive_file_id: photoDriveFileId || null,
    season,
    occasion,
    visible_to_partner: visibleToPartner,
  }

  if (id) {
    // Update only your own item; RLS blocks editing the partner's.
    const { error } = await supabase
      .from('wardrobe_items')
      .update(payload)
      .eq('id', id)
      .eq('owner_user_id', user.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('wardrobe_items').insert(payload)
    if (error) return { error: error.message }
  }

  revalidatePath('/wardrobe')
  redirect('/wardrobe')
}

/** Soft-delete one of the caller's own items. */
export async function deleteItemAction(formData: FormData): Promise<void> {
  const { user } = await requireHousehold()
  const id = str(formData, 'id')
  if (!id) return
  const supabase = await createClient()
  await supabase
    .from('wardrobe_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_user_id', user.id)
  revalidatePath('/wardrobe')
}

/**
 * Laundry transition (worn / send to wash / wash done). Bulk-capable: accepts one
 * or more `ids`. Only the caller's own items are touched.
 */
export async function setLaundryStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireHousehold()
  const status = str(formData, 'status')
  if (!isLaundryStatus(status)) return
  const ids = formData.getAll('ids').map((v) => String(v)).filter(Boolean)
  if (ids.length === 0) return

  const supabase = await createClient()
  await supabase
    .from('wardrobe_items')
    .update({ laundry_status: status })
    .in('id', ids)
    .eq('owner_user_id', user.id)
  revalidatePath('/wardrobe')
}

/** Save a generated / hand-picked outfit as an `outfits` row owned by the caller. */
export async function saveOutfitAction(formData: FormData): Promise<ActionResult> {
  const { user, householdId } = await requireHousehold()
  const name = str(formData, 'name')
  if (!name) return { error: 'Please name this outfit.' }
  const occasion = str(formData, 'occasion')
  const itemIds = formData
    .getAll('item_ids')
    .map((v) => String(v))
    .filter(Boolean)
  const photoDriveFileId = str(formData, 'photo_drive_file_id')

  const supabase = await createClient()
  const { error } = await supabase.from('outfits').insert({
    household_id: householdId,
    owner_user_id: user.id,
    name,
    occasion: occasion || null,
    item_ids: itemIds,
    photo_drive_file_id: photoDriveFileId || null,
  })
  if (error) return { error: error.message }

  revalidatePath('/wardrobe/occasions')
  return { success: true }
}

/** Soft-delete one of the caller's own outfits. */
export async function deleteOutfitAction(formData: FormData): Promise<void> {
  const { user } = await requireHousehold()
  const id = str(formData, 'id')
  if (!id) return
  const supabase = await createClient()
  await supabase
    .from('outfits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_user_id', user.id)
  revalidatePath('/wardrobe/occasions')
}

/** Upsert the caller's per-user sizes + style notes (own row only). */
export async function savePreferencesAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireHousehold()
  const styleNotes = str(formData, 'style_notes_md')

  // sizes arrives as parallel key[]/value[] arrays from the dynamic form.
  const keys = formData.getAll('size_key').map((v) => String(v).trim())
  const values = formData.getAll('size_value').map((v) => String(v).trim())
  const sizes: Record<string, string> = {}
  keys.forEach((k, i) => {
    const v = values[i] ?? ''
    if (k) sizes[k] = v
  })

  const supabase = await createClient()
  const { error } = await supabase.from('wardrobe_preferences').upsert(
    {
      user_id: user.id,
      sizes,
      style_notes_md: styleNotes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) return { error: error.message }

  revalidatePath('/wardrobe/preferences')
  return { success: true }
}
