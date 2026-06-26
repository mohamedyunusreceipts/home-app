'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type IngredientInputDTO = {
  name: string
  qty: number | null
  unit: string | null
}

export type CreateRecipeResult = { error: string } | { success: true; id: string }

function intOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : null
}

/**
 * Create a recipe and its ingredient rows. `photo_drive_file_id` is supplied by
 * the client after a successful /api/drive/upload (or omitted if Drive isn't
 * connected — the form degrades to no photo). Ingredients arrive as a JSON
 * string in the `ingredients` field.
 */
export async function createRecipeAction(formData: FormData): Promise<CreateRecipeResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Please give the recipe a name.' }

  const servings = intOrNull(formData.get('servings'))
  const prepMin = intOrNull(formData.get('prep_min'))
  const cookMin = intOrNull(formData.get('cook_min'))
  const instructions = String(formData.get('instructions_md') ?? '').trim()
  const sourceUrl = String(formData.get('source_url') ?? '').trim()
  const photoDriveFileId = String(formData.get('photo_drive_file_id') ?? '').trim()
  const tagsRaw = String(formData.get('tags') ?? '').trim()
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  let ingredients: IngredientInputDTO[] = []
  const ingredientsRaw = String(formData.get('ingredients') ?? '').trim()
  if (ingredientsRaw) {
    try {
      const parsed = JSON.parse(ingredientsRaw) as unknown
      if (Array.isArray(parsed)) {
        ingredients = parsed
          .map((row) => {
            const r = (row ?? {}) as Record<string, unknown>
            const iname = typeof r.name === 'string' ? r.name.trim() : ''
            if (!iname) return null
            const qty =
              typeof r.qty === 'number' && Number.isFinite(r.qty) ? r.qty : null
            const unit = typeof r.unit === 'string' && r.unit.trim() ? r.unit.trim() : null
            return { name: iname, qty, unit }
          })
          .filter((x): x is IngredientInputDTO => x !== null)
      }
    } catch {
      return { error: 'Could not read the ingredient list.' }
    }
  }

  const { data: inserted, error } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      name,
      photo_drive_file_id: photoDriveFileId || null,
      servings,
      prep_min: prepMin,
      cook_min: cookMin,
      instructions_md: instructions || null,
      source_url: sourceUrl || null,
      tags,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !inserted) {
    return { error: error?.message ?? 'Could not save the recipe.' }
  }

  if (ingredients.length > 0) {
    const rows = ingredients.map((i) => ({
      household_id: householdId,
      recipe_id: inserted.id,
      name: i.name,
      qty: i.qty,
      unit: i.unit,
    }))
    const { error: ingError } = await supabase.from('recipe_ingredients').insert(rows)
    if (ingError) {
      // Best-effort cleanup so we don't leave a recipe with no ingredients.
      await supabase.from('recipes').delete().eq('id', inserted.id)
      return { error: ingError.message }
    }
  }

  return { success: true, id: inserted.id }
}
