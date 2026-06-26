'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { error: string } | { success: true }

export type CatalogueKind = 'food' | 'dessert'

function isKind(value: unknown): value is CatalogueKind {
  return value === 'food' || value === 'dessert'
}

/** Add a catalogue item for the caller's household. Duplicates (case-insensitive) are rejected gracefully. */
export async function addCatalogueItem(kind: CatalogueKind, name: string): Promise<ActionResult> {
  if (!isKind(kind)) return { error: 'Unknown catalogue.' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Please enter a name.' }

  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { error } = await supabase.from('catalogue_items').insert({
    household_id: householdId,
    kind,
    name: trimmed,
  })

  if (error) {
    // Unique-violation: the item is already in this catalogue.
    if (error.code === '23505') {
      return { error: `“${trimmed}” is already in the list.` }
    }
    return { error: error.message }
  }
  return { success: true }
}

/** Remove a catalogue item by id. RLS scopes the delete to the caller's household. */
export async function removeCatalogueItem(id: string): Promise<ActionResult> {
  if (!id) return { error: 'Nothing to remove.' }

  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { error } = await supabase
    .from('catalogue_items')
    .delete()
    .eq('household_id', householdId)
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}
