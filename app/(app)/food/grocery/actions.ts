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

/** Add a manual grocery item (source='manual'). */
export async function addGroceryItemAction(formData: FormData): Promise<ActionResult> {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Please enter an item name.' }

  const { error } = await supabase.from('grocery_items').insert({
    household_id: householdId,
    name,
    qty: numOrNull(formData.get('qty')),
    unit: String(formData.get('unit') ?? '').trim() || null,
    source: 'manual',
    checked: false,
    added_by_user_id: user.id,
  })
  if (error) return { error: error.message }
  return { success: true }
}

/** Toggle the checked flag on a grocery item. */
export async function toggleGroceryItemAction(id: string, checked: boolean): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const { error } = await supabase
    .from('grocery_items')
    .update({ checked })
    .eq('household_id', householdId)
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

/** Clear all checked items (soft-delete). */
export async function clearCheckedAction(): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const { error } = await supabase
    .from('grocery_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .eq('checked', true)
    .is('deleted_at', null)
  if (error) return { error: error.message }
  return { success: true }
}
