import Link from 'next/link'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { ScreenHeader } from '@/components/shell/screen-header'
import { WardrobeTabs } from '@/components/wardrobe/tabs'
import { ItemCard } from '@/components/wardrobe/item-card'
import { TodaysOutfit } from '@/components/wardrobe/todays-outfit'
import { toDisplayItem } from '@/components/wardrobe/item-label'
import { ITEM_COLUMNS, type WardrobeItemRow } from '@/components/wardrobe/types'

/** Terracotta "Add item" pill for the ScreenHeader action slot. */
function AddItemAction() {
  return (
    <Link
      href="/wardrobe/items/new"
      className="inline-flex items-center transition-colors hover:bg-terracotta-500"
      style={{
        background: '#C77B5C',
        color: '#FFFDF9',
        borderRadius: 20,
        padding: '7px 15px',
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      Add item
    </Link>
  )
}

export default async function MyWardrobePage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('wardrobe_items')
    .select(ITEM_COLUMNS)
    .eq('household_id', householdId)
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<WardrobeItemRow[]>()

  const rows = items ?? []
  const outfitItems = rows.map(toDisplayItem)

  return (
    <main className="mx-auto max-w-xl" style={{ padding: '8px 22px 120px' }}>
      <ScreenHeader title="Wardrobe" action={<AddItemAction />} />

      <WardrobeTabs active="/wardrobe" />

      {/* Today's outfit — reuses the deterministic outfit generator + shell toast. */}
      <div className="mt-5">
        <TodaysOutfit items={outfitItems} />
      </div>

      {/* Item count + grid. */}
      <p
        className="mt-6"
        style={{
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: '#7A9B7A',
        }}
      >
        {rows.length} {rows.length === 1 ? 'item' : 'items'}
      </p>

      {rows.length === 0 ? (
        <div
          className="mt-3 text-center"
          style={{
            background: '#FFFDF9',
            border: '1px solid #E8DFCE',
            borderRadius: 18,
            padding: '30px 22px',
          }}
        >
          <p style={{ fontSize: 14, color: '#3F2118', fontWeight: 600 }}>
            Your wardrobe is empty
          </p>
          <p className="mt-1" style={{ fontSize: 13, color: '#8a7163' }}>
            Snap a garment and tag it — then we&apos;ll start shuffling outfits for you.
          </p>
          <Link
            href="/wardrobe/items/new"
            className="mt-4 inline-flex items-center transition-colors hover:bg-terracotta-500"
            style={{
              background: '#C77B5C',
              color: '#FFFDF9',
              borderRadius: 20,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Add your first item
          </Link>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {rows.map((item) => (
            <ItemCard key={item.id} item={item} editable />
          ))}
        </div>
      )}
    </main>
  )
}
