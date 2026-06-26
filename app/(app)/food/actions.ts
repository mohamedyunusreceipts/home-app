'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { generateGroceryList } from '@/components/food/grocery-gen'
import { weekDates, MEAL_SLOTS, type MealSlot } from '@/components/food/types'

export type ActionResult = { error: string } | { success: true }

function isSlot(value: string): value is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value)
}

/**
 * Assign a meal-plan slot. An empty recipe + empty free-text clears the slot
 * (soft-delete). Exactly one of recipe_id / free_text may be set.
 */
export async function assignMealAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const date = String(formData.get('date') ?? '').trim()
  const slotRaw = String(formData.get('slot') ?? '').trim()
  const recipeId = String(formData.get('recipe_id') ?? '').trim()
  const freeText = String(formData.get('free_text') ?? '').trim()

  if (!date) return { error: 'Missing date.' }
  if (!isSlot(slotRaw)) return { error: 'Invalid meal slot.' }

  // Clear any existing assignment for this slot first (soft-delete).
  await supabase
    .from('meal_plan')
    .update({ deleted_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .eq('date', date)
    .eq('slot', slotRaw)
    .is('deleted_at', null)

  // Empty submission just clears the slot.
  if (!recipeId && !freeText) return { success: true }

  const { error } = await supabase.from('meal_plan').insert({
    household_id: householdId,
    date,
    slot: slotRaw,
    recipe_id: recipeId || null,
    free_text: recipeId ? null : freeText || null,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export type BuildListResult = { error: string } | { success: true; added: number }

/**
 * "Build list from this week's meals" — the deterministic generator.
 * Loads the week's planned recipes' ingredients + the current pantry, diffs
 * them via the PURE generateGroceryList(), and inserts the shortfall as
 * grocery_items with source='meal_plan'.
 */
export async function buildListFromWeekAction(weekStart: string): Promise<BuildListResult> {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const dates = weekDates(weekStart)

  // Planned meals for the week that point at a recipe.
  const { data: plan } = await supabase
    .from('meal_plan')
    .select('recipe_id')
    .eq('household_id', householdId)
    .in('date', dates)
    .is('deleted_at', null)
    .not('recipe_id', 'is', null)
    .returns<{ recipe_id: string }[]>()

  const recipeIds = [...new Set((plan ?? []).map((p) => p.recipe_id))]
  if (recipeIds.length === 0) {
    return { error: 'No recipes are planned for this week yet.' }
  }

  const { data: ingredients } = await supabase
    .from('recipe_ingredients')
    .select('name, qty, unit')
    .eq('household_id', householdId)
    .in('recipe_id', recipeIds)
    .is('deleted_at', null)
    .returns<{ name: string; qty: number | null; unit: string | null }[]>()

  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('name, qty, unit')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .returns<{ name: string; qty: number | null; unit: string | null }[]>()

  const lines = generateGroceryList(ingredients ?? [], pantry ?? [])
  if (lines.length === 0) {
    return { success: true, added: 0 }
  }

  const rows = lines.map((l) => ({
    household_id: householdId,
    name: l.name,
    qty: l.qty,
    unit: l.unit,
    source: 'meal_plan' as const,
    checked: false,
    added_by_user_id: user.id,
  }))

  const { error } = await supabase.from('grocery_items').insert(rows)
  if (error) return { error: error.message }

  return { success: true, added: rows.length }
}
