import { Card, CardContent } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { WardrobeTabs } from '@/components/wardrobe/tabs'
import { LaundryClient } from '@/components/wardrobe/laundry-client'
import { ITEM_COLUMNS, type WardrobeItemRow } from '@/components/wardrobe/types'

export default async function LaundryPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  // Only the caller's own items — you manage your own laundry (RLS WITH CHECK
  // would block updates to the partner's items anyway).
  const { data: items } = await supabase
    .from('wardrobe_items')
    .select(ITEM_COLUMNS)
    .eq('household_id', householdId)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .order('category', { ascending: true })
    .returns<WardrobeItemRow[]>()

  const rows = items ?? []

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Laundry-aware outfits</h1>
        <WardrobeTabs active="/wardrobe/laundry" />

        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sage-800">
              <p>
                Add items to your wardrobe to start tracking what is clean, worn or
                in the wash. The outfit generator skips anything that is in the wash.
              </p>
            </CardContent>
          </Card>
        ) : (
          <LaundryClient items={rows} />
        )}
      </div>
    </main>
  )
}
