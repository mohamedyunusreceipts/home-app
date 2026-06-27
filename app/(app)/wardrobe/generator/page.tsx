import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { WardrobeTabs } from '@/components/wardrobe/tabs'
import { GeneratorClient } from '@/components/wardrobe/generator-client'
import { WardrobeAiSuggest } from '@/components/wardrobe/ai-suggest'
import { toDisplayItem } from '@/components/wardrobe/item-label'
import { ITEM_COLUMNS, type WardrobeItemRow } from '@/components/wardrobe/types'

export default async function GeneratorPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('wardrobe_items')
    .select(ITEM_COLUMNS)
    .eq('household_id', householdId)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .returns<WardrobeItemRow[]>()

  const rows = items ?? []
  const display = rows.map(toDisplayItem)
  const aiItemLabels = display.map((d) => d.label)

  return (
    <main className="min-h-screen p-8 pb-28">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Outfit generator</h1>
        <WardrobeTabs active="/wardrobe/generator" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Build an outfit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GeneratorClient items={display} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Or ask AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WardrobeAiSuggest
              buildContext={() => ({
                occasion: 'an everyday outfit',
                items: aiItemLabels,
              })}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
