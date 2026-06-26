import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { FoodTabs } from '@/components/food/tabs'
import { startOfWeek, weekDates, type MealPlanRow, type RecipeRow } from '@/components/food/types'
import {
  MealPlanGrid,
  type PlanMap,
  type RecipeOption,
} from './meal-plan-grid'

export default async function FoodMealPlanPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const weekStart = startOfWeek()
  const dates = weekDates(weekStart)

  const { data: recipeRows } = await supabase
    .from('recipes')
    .select('id, name')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .returns<Pick<RecipeRow, 'id' | 'name'>[]>()

  const { data: planRows } = await supabase
    .from('meal_plan')
    .select('id, household_id, date, slot, recipe_id, free_text')
    .eq('household_id', householdId)
    .in('date', dates)
    .is('deleted_at', null)
    .returns<MealPlanRow[]>()

  const recipes: RecipeOption[] = (recipeRows ?? []).map((r) => ({ id: r.id, name: r.name }))

  const plan: PlanMap = {}
  for (const row of planRows ?? []) {
    plan[`${row.date}|${row.slot}`] = {
      recipeId: row.recipe_id,
      freeText: row.free_text,
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl text-terracotta-700">Food &amp; Groceries</h1>
          <p className="text-sage-600">Plan the week, then build your list in one tap.</p>
        </header>

        <FoodTabs active="/food" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">This week&apos;s meals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipes.length === 0 ? (
              <p className="text-sage-700">
                Add a recipe first, then assign it to a day — or type a free-text meal
                straight into any slot below.
              </p>
            ) : null}
            <MealPlanGrid weekStart={weekStart} dates={dates} recipes={recipes} plan={plan} />
          </CardContent>
        </Card>

        <Link href="/food/catalogue" className="block">
          <Card className="transition hover:ring-terracotta-300">
            <CardHeader>
              <CardTitle className="font-serif text-terracotta-700">
                Meals &amp; desserts catalogue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sage-700">
                Your curated list of dishes and desserts you love — add what you like, remove
                what you don&apos;t.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  )
}
