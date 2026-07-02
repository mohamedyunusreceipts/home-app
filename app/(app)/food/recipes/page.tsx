import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { FoodTabs } from '@/components/food/tabs'
import { AiSuggest } from '@/components/food/ai-suggest'
import type { RecipeRow, PantryItemRow } from '@/components/food/types'
import { RecipeForm } from './recipe-form'

export default async function RecipesPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, servings, prep_min, cook_min, tags, source_url, photo_drive_file_id')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<
      Pick<
        RecipeRow,
        'id' | 'name' | 'servings' | 'prep_min' | 'cook_min' | 'tags' | 'source_url' | 'photo_drive_file_id'
      >[]
    >()

  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('name')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .returns<Pick<PantryItemRow, 'name'>[]>()

  const pantryNames = (pantry ?? []).map((p) => p.name)

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl text-terracotta-700">Recipes</h1>
        </header>

        <FoodTabs active="/food/recipes" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Recipe ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <AiSuggest
              kind="recipe_ideas"
              label="Suggest recipes from my pantry"
              context={{ ingredients: pantryNames }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Your recipes</CardTitle>
          </CardHeader>
          <CardContent>
            {(recipes ?? []).length === 0 ? (
              <p className="text-sage-700">No recipes yet. Add your first below.</p>
            ) : (
              <ul className="divide-y divide-sage-100">
                {(recipes ?? []).map((r) => (
                  <li key={r.id} className="py-3">
                    <p className="font-medium text-sage-900">{r.name}</p>
                    <p className="text-sm text-sage-600">
                      {[
                        r.servings ? `${r.servings} servings` : null,
                        r.prep_min != null ? `${r.prep_min} min prep` : null,
                        r.cook_min != null ? `${r.cook_min} min cook` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {r.tags.length > 0 && (
                      <p className="mt-1 text-xs text-sage-500">{r.tags.join(', ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Add a recipe</CardTitle>
          </CardHeader>
          <CardContent>
            <RecipeForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
