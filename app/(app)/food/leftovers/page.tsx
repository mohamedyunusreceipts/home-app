import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { FoodTabs } from '@/components/food/tabs'
import { AiSuggest } from '@/components/food/ai-suggest'
import type { LeftoverRow, RecipeRow, PantryItemRow } from '@/components/food/types'
import { LeftoversList } from './leftovers-list'

export default async function LeftoversPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: leftovers } = await supabase
    .from('leftovers')
    .select('id, household_id, name, consume_by, from_recipe_id')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('consume_by', { ascending: true })
    .returns<LeftoverRow[]>()

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .returns<Pick<RecipeRow, 'id' | 'name'>[]>()

  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('name')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .returns<Pick<PantryItemRow, 'name'>[]>()

  const leftoverNames = (leftovers ?? []).map((l) => l.name)
  const pantryNames = (pantry ?? []).map((p) => p.name)

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl text-terracotta-700">Leftovers</h1>
          <p className="text-sage-600">Track what needs eating soon and get ideas to use it up.</p>
        </header>

        <FoodTabs active="/food/leftovers" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Use it up</CardTitle>
          </CardHeader>
          <CardContent>
            <AiSuggest
              kind="leftover_ideas"
              label="Suggest leftover ideas"
              buildContext={() => ({ leftovers: leftoverNames, pantry: pantryNames })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Tracked leftovers</CardTitle>
          </CardHeader>
          <CardContent>
            <LeftoversList items={leftovers ?? []} recipes={recipes ?? []} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
