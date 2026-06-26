import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { FoodTabs } from '@/components/food/tabs'
import type { GroceryItemRow } from '@/components/food/types'
import { GroceryList } from './grocery-list'

export default async function GroceryPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('grocery_items')
    .select('id, household_id, name, qty, unit, source, checked, added_by_user_id')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('checked', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<GroceryItemRow[]>()

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl text-terracotta-700">Grocery list</h1>
        </header>

        <FoodTabs active="/food/grocery" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">What to buy</CardTitle>
          </CardHeader>
          <CardContent>
            <GroceryList items={items ?? []} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
