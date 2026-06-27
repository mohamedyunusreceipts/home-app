import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { WardrobeTabs } from '@/components/wardrobe/tabs'
import { deleteOutfitAction } from '@/app/(app)/wardrobe/actions'
import { formatDate } from '@/components/wardrobe/format'
import { OUTFIT_COLUMNS, type OutfitRow } from '@/components/wardrobe/types'

export default async function OccasionOutfitsPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  // My saved outfits, grouped by occasion. (Partner outfits are viewable within
  // the household via RLS, but this tab focuses on the user's own saved looks.)
  const { data: outfits } = await supabase
    .from('outfits')
    .select(OUTFIT_COLUMNS)
    .eq('household_id', householdId)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .order('saved_at', { ascending: false })
    .returns<OutfitRow[]>()

  const rows = outfits ?? []

  // Group by occasion label ("Unsorted" when none).
  const groups = new Map<string, OutfitRow[]>()
  for (const o of rows) {
    const key = o.occasion?.trim() || 'Unsorted'
    const list = groups.get(key) ?? []
    list.push(o)
    groups.set(key, list)
  }

  return (
    <main className="min-h-screen p-8 pb-28">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Occasion outfits</h1>
        <WardrobeTabs active="/wardrobe/occasions" />

        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sage-800">
              <p>
                No saved outfits yet. Head to the outfit generator, build a look you
                like, and save it — it will show up here grouped by occasion.
              </p>
            </CardContent>
          </Card>
        ) : (
          [...groups.entries()].map(([occasion, list]) => (
            <section key={occasion} className="space-y-3">
              <h2 className="font-serif text-xl text-terracotta-700">{occasion}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {list.map((o) => (
                  <Card key={o.id}>
                    <CardContent className="space-y-2 p-4">
                      <p className="font-medium text-sage-900">{o.name}</p>
                      <p className="text-sm text-sage-600">
                        {o.item_ids.length} item{o.item_ids.length === 1 ? '' : 's'} ·
                        saved {formatDate(o.saved_at)}
                      </p>
                      <form action={deleteOutfitAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <Button type="submit" variant="outline">
                          Delete
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  )
}
