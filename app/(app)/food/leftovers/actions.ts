'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { error: string } | { success: true }

/** Add a leftover with a consume-by date, optionally linked to a recipe. */
export async function addLeftoverAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = String(formData.get('name') ?? '').trim()
  const consumeBy = String(formData.get('consume_by') ?? '').trim()
  const fromRecipeId = String(formData.get('from_recipe_id') ?? '').trim()

  if (!name) return { error: 'Please name the leftover.' }
  if (!consumeBy) return { error: 'Please choose a consume-by date.' }

  const { error } = await supabase.from('leftovers').insert({
    household_id: householdId,
    name,
    consume_by: consumeBy,
    from_recipe_id: fromRecipeId || null,
  })
  if (error) return { error: error.message }
  return { success: true }
}

/** Mark a leftover as eaten / gone (soft-delete). */
export async function removeLeftoverAction(id: string): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const { error } = await supabase
    .from('leftovers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return { error: error.message }
  return { success: true }
}
