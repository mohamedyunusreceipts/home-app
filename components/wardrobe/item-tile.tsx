import Link from 'next/link'
import type { WardrobeItemRow } from './types'
import { CATEGORY_LABELS, LAUNDRY_LABELS } from './format'

/**
 * Compact square wardrobe tile for the 3-column Items grid (Focus Timeline
 * redesign). Fits three across at 360px: a square placeholder/photo with a
 * laundry-status chip overlaid, then a one-line category·colour label and brand.
 *
 * The whole tile links to the item's edit page, so laundry actions and full
 * details stay one tap away (the dense card with inline laundry buttons is kept
 * for the read-only partner view). A private item shows a small "Private" mark.
 */
export function ItemTile({ item }: { item: WardrobeItemRow }) {
  const label = `${CATEGORY_LABELS[item.category] ?? item.category}${
    item.color ? ` · ${item.color}` : ''
  }`

  return (
    <Link
      href={`/wardrobe/items/${item.id}`}
      className="group/tile block min-w-0"
      aria-label={`Edit ${label}`}
    >
      <div
        className="relative w-full overflow-hidden rounded-xl border border-sage-200 bg-sage-50"
        style={{ aspectRatio: '1 / 1' }}
      >
        {/* Square placeholder weave (no photo rendering pipeline yet). */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundColor: '#EADFCB',
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 7px, rgba(122,155,122,0.16) 7px, rgba(122,155,122,0.16) 14px)',
          }}
        />
        <span className="absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded-full bg-sage-100/90 px-1.5 py-0.5 text-[10px] font-medium text-sage-700">
          {LAUNDRY_LABELS[item.laundry_status] ?? item.laundry_status}
        </span>
        {!item.visible_to_partner && (
          <span className="absolute right-1 top-1 rounded-full bg-cream-50/90 px-1.5 py-0.5 text-[10px] font-medium text-sage-500">
            Private
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs font-medium text-sage-900" title={label}>
        {label}
      </p>
      {item.brand && (
        <p className="truncate text-[11px] text-sage-600">{item.brand}</p>
      )}
    </Link>
  )
}
