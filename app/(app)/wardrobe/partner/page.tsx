import { Card, CardContent } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { WardrobeTabs } from '@/components/wardrobe/tabs'
import { ItemCard } from '@/components/wardrobe/item-card'
import { ITEM_COLUMNS, type WardrobeItemRow } from '@/components/wardrobe/types'

export default async function PartnerWardrobePage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  // Items in the household NOT owned by me. RLS already filters out any of the
  // partner's items flagged visible_to_partner=false, so this only returns what
  // the partner has chosen to share (spec §9.6 per-user privacy).
  const { data: items } = await supabase
    .from('wardrobe_items')
    .select(ITEM_COLUMNS)
    .eq('household_id', householdId)
    .neq('owner_user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<WardrobeItemRow[]>()

  const rows = items ?? []

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Partner wardrobe</h1>
        <WardrobeTabs active="/wardrobe/partner" />

        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sage-800">
              <p>
                Nothing to show yet. Items your partner adds appear here once they
                choose to share them. Private items (and underwear by default) stay
                hidden.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((item) => (
              <ItemCard key={item.id} item={item} editable={false} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
