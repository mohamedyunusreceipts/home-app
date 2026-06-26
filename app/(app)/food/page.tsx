import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import {
  startOfWeek,
  weekDates,
  MEAL_SLOTS,
  type MealPlanRow,
  type MealSlot,
  type RecipeRow,
} from '@/components/food/types'
import { todayIsoJhb } from '@/components/dashboard/feed'
import { FoodLanding, type DayPlan, type SlotMeal } from '@/components/food/food-landing'
import type { CatalogueOption, PlanMap, RecipeOption } from './meal-plan-grid'

type CatalogueRow = { id: string; kind: 'food' | 'dessert'; name: string }

export default async function FoodMealPlanPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const weekStart = startOfWeek()
  const dates = weekDates(weekStart)
  const today = todayIsoJhb()

  const [{ data: recipeRows }, { data: planRows }, { data: catalogueRows }, { count: groceryCount }] =
    await Promise.all([
      supabase
        .from('recipes')
        .select('id, name')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .returns<Pick<RecipeRow, 'id' | 'name'>[]>(),
      supabase
        .from('meal_plan')
        .select('id, household_id, date, slot, recipe_id, free_text')
        .eq('household_id', householdId)
        .in('date', dates)
        .is('deleted_at', null)
        .returns<MealPlanRow[]>(),
      supabase
        .from('catalogue_items')
        .select('id, kind, name')
        .eq('household_id', householdId)
        .order('name', { ascending: true })
        .returns<CatalogueRow[]>(),
      supabase
        .from('grocery_items')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .eq('checked', false),
    ])

  const recipes: RecipeOption[] = (recipeRows ?? []).map((r) => ({ id: r.id, name: r.name }))
  const recipeNames: Record<string, string> = {}
  for (const r of recipeRows ?? []) recipeNames[r.id] = r.name

  const catalogue: CatalogueOption[] = (catalogueRows ?? []).map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
  }))

  // Full plan map (used by the week grid, kept reachable).
  const plan: PlanMap = {}
  for (const row of planRows ?? []) {
    plan[`${row.date}|${row.slot}`] = {
      recipeId: row.recipe_id,
      freeText: row.free_text,
    }
  }

  // Resolve a slot assignment to a display label from real data.
  function labelFor(date: string, slot: MealSlot): string | null {
    const a = plan[`${date}|${slot}`]
    if (!a) return null
    if (a.recipeId) return recipeNames[a.recipeId] ?? null
    return a.freeText ?? null
  }

  // Today's three meals (Breakfast / Lunch / Dinner) from real meal_plan.
  const todayMeals: SlotMeal[] = MEAL_SLOTS.map((slot) => ({
    slot,
    label: labelFor(today, slot),
  }))

  // Rest of the week = the remaining days after today, with their dinner (the
  // headline meal of a day) surfaced on each day-card.
  const restOfWeek: DayPlan[] = dates
    .filter((d) => d > today)
    .map((date) => ({
      date,
      dinner: labelFor(date, 'dinner'),
      lunch: labelFor(date, 'lunch'),
      breakfast: labelFor(date, 'breakfast'),
    }))

  return (
    <main className="mx-auto max-w-xl px-[22px] pt-2 pb-[120px]">
      <ScreenHeader title="Food" />
      <FoodLanding
        today={today}
        weekStart={weekStart}
        dates={dates}
        todayMeals={todayMeals}
        restOfWeek={restOfWeek}
        groceryCount={groceryCount ?? 0}
        recipes={recipes}
        catalogue={catalogue}
        plan={plan}
      />
    </main>
  )
}
