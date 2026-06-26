import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { WardrobeTabs } from '@/components/wardrobe/tabs'
import { GeneratorClient } from '@/components/wardrobe/generator-client'
import { toDisplayItem } from '@/components/wardrobe/item-label'
import { ITEM_COLUMNS, type WardrobeItemRow } from '@/components/wardrobe/types'

export default async function PackingOutfitsPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('wardrobe_items')
    .select(ITEM_COLUMNS)
    .eq('household_id', householdId)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .returns<WardrobeItemRow[]>()

  const display = (items ?? []).map(toDisplayItem)

  // Cross-module exclusion (spec §9.6): items already in an active trip's packing
  // list should be excluded so you don't plan an outfit around something already
  // packed. The Travel module owns packing_items; until it is wired up here, the
  // exclude list is empty. The generator accepts the id list, so the integration
  // is a one-line change once Travel exists.
  const packedItemIds: string[] = []

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Packing outfits</h1>
        <WardrobeTabs active="/wardrobe/packing" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Plan outfits to pack
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-sage-600">
              Generate outfits for a trip. Items in the wash are skipped, and once
              the Travel module is linked, anything already on an active trip&rsquo;s
              packing list is excluded too.
            </p>
            <GeneratorClient items={display} excludeIds={packedItemIds} packingMode />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
