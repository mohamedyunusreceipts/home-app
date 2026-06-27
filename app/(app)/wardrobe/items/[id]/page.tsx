import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { ItemForm, type ItemDefaults } from '@/components/wardrobe/item-form'
import { deleteItemAction } from '@/app/(app)/wardrobe/actions'
import { ITEM_COLUMNS, type WardrobeItemRow } from '@/components/wardrobe/types'

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('wardrobe_items')
    .select(ITEM_COLUMNS)
    .eq('id', id)
    .eq('household_id', householdId)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle<WardrobeItemRow>()

  // Only the owner can edit; RLS + the owner filter guarantee this.
  if (!item) notFound()

  const defaults: ItemDefaults = {
    id: item.id,
    category: item.category,
    color: item.color ?? '',
    brand: item.brand ?? '',
    size: item.size ?? '',
    notes: item.notes ?? '',
    season: item.season.join(', '),
    occasion: item.occasion.join(', '),
    photoDriveFileId: item.photo_drive_file_id ?? '',
    visibleToPartner: item.visible_to_partner,
  }

  return (
    <main className="min-h-screen p-8 pb-28">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Edit item</h1>
          <Link href="/wardrobe">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Item details</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemForm defaults={defaults} ownerUserId={user.id} />
          </CardContent>
        </Card>

        <form action={deleteItemAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button type="submit" variant="outline">
            Delete this item
          </Button>
        </form>
      </div>
    </main>
  )
}
