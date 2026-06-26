import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import type { WardrobeItemRow } from './types'
import { CATEGORY_LABELS, LAUNDRY_LABELS } from './format'
import { LaundryButtons } from './laundry-buttons'

/**
 * A single wardrobe item tile. `editable` is true on the owner's own wardrobe
 * (adds an Edit link + laundry actions); false on the partner view (read-only).
 */
export function ItemCard({
  item,
  editable,
}: {
  item: WardrobeItemRow
  editable: boolean
}) {
  const tags = [...item.occasion, ...item.season]
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sage-900">
              {CATEGORY_LABELS[item.category] ?? item.category}
              {item.color ? ` · ${item.color}` : ''}
            </p>
            {item.brand && <p className="text-sm text-sage-600">{item.brand}</p>}
          </div>
          <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs text-sage-700">
            {LAUNDRY_LABELS[item.laundry_status] ?? item.laundry_status}
          </span>
        </div>

        {item.size && <p className="text-sm text-sage-600">Size {item.size}</p>}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="rounded-full border border-sage-200 px-2 py-0.5 text-xs text-sage-600"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {item.notes && <p className="text-sm text-sage-600">{item.notes}</p>}

        {editable && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href={`/wardrobe/items/${item.id}`}
              className="text-sm font-medium text-terracotta-700 hover:underline"
            >
              Edit
            </Link>
            {!item.visible_to_partner && (
              <span className="text-xs text-sage-500">Private</span>
            )}
            <LaundryButtons ids={[item.id]} status={item.laundry_status} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
