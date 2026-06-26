'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { error: string } | { success: true }

function numOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Add a pantry item. */
export async function addPantryItemAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Please enter an item name.' }

  const expiresOn = String(formData.get('expires_on') ?? '').trim()

  const { error } = await supabase.from('pantry_items').insert({
    household_id: householdId,
    name,
    qty: numOrNull(formData.get('qty')),
    unit: String(formData.get('unit') ?? '').trim() || null,
    expires_on: expiresOn || null,
  })
  if (error) return { error: error.message }
  return { success: true }
}

/** Remove a pantry item (soft-delete). */
export async function removePantryItemAction(id: string): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const { error } = await supabase
    .from('pantry_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return { error: error.message }
  return { success: true }
}
