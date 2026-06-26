import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { FoodTabs } from '@/components/food/tabs'
import type { PantryItemRow } from '@/components/food/types'
import { PantryList } from './pantry-list'

export default async function PantryPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('pantry_items')
    .select('id, household_id, name, qty, unit, expires_on')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    // Items with an expiry first (soonest first), then the rest by name.
    .order('expires_on', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
    .returns<PantryItemRow[]>()

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl text-terracotta-700">Pantry</h1>
        </header>

        <FoodTabs active="/food/pantry" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">On hand</CardTitle>
          </CardHeader>
          <CardContent>
            <PantryList items={items ?? []} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
