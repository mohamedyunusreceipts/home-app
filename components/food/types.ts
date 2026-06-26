// DB row shapes for the Food module (snake_case, as returned from Supabase).
// Kept inside components/food to stay within this workstream's scope.

export type MealSlot = 'breakfast' | 'lunch' | 'dinner'
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner']

export type GrocerySource = 'manual' | 'meal_plan' | 'recipe'

export type RecipeRow = {
  id: string
  household_id: string
  name: string
  photo_drive_file_id: string | null
  servings: number | null
  prep_min: number | null
  cook_min: number | null
  instructions_md: string | null
  source_url: string | null
  tags: string[]
  created_at: string
}

export type RecipeIngredientRow = {
  id: string
  household_id: string
  recipe_id: string
  name: string
  qty: number | null
  unit: string | null
  pantry_item_id: string | null
}

export type MealPlanRow = {
  id: string
  household_id: string
  date: string
  slot: MealSlot
  recipe_id: string | null
  free_text: string | null
}

export type PantryItemRow = {
  id: string
  household_id: string
  name: string
  qty: number | null
  unit: string | null
  expires_on: string | null
}

export type GroceryItemRow = {
  id: string
  household_id: string
  name: string
  qty: number | null
  unit: string | null
  source: GrocerySource
  checked: boolean
  added_by_user_id: string | null
}

export type LeftoverRow = {
  id: string
  household_id: string
  name: string
  consume_by: string
  from_recipe_id: string | null
}

/** Compute the ISO date (YYYY-MM-DD) of Monday for the week containing `ref`. */
export function startOfWeek(ref = new Date()): string {
  const d = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()))
  const day = d.getUTCDay() // 0 = Sun … 6 = Sat
  const diff = (day + 6) % 7 // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

/** The seven ISO dates of the week starting at `mondayIso`. */
export function weekDates(mondayIso: string): string[] {
  const base = new Date(`${mondayIso}T00:00:00Z`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}
