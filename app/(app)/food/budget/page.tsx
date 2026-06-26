import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { FoodTabs } from '@/components/food/tabs'
import type { PantryItemRow } from '@/components/food/types'
import { BudgetMealsPanel } from './budget-panel'

export default async function BudgetMealsPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('name')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .returns<Pick<PantryItemRow, 'name'>[]>()

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl text-terracotta-700">Budget meals</h1>
          <p className="text-sage-600">
            Get affordable meal ideas for the week, using what you already have.
          </p>
        </header>

        <FoodTabs active="/food/budget" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Plan on a budget</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetMealsPanel pantryNames={(pantry ?? []).map((p) => p.name)} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
