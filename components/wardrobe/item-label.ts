import type { WardrobeItemRow } from './types'
import type { GenItem } from './outfit-gen'
import { CATEGORY_LABELS } from './format'

/** A human label for a wardrobe item, e.g. "Navy top (work, summer)". */
export function itemLabel(item: WardrobeItemRow): string {
  const head = [item.color, CATEGORY_LABELS[item.category]?.toLowerCase() ?? item.category]
    .filter(Boolean)
    .join(' ')
  const tags = [...item.occasion, ...item.season]
  const name = item.brand ? `${item.brand} ${head}` : head
  return tags.length > 0 ? `${name} (${tags.join(', ')})` : name
}

/** Map a DB row to the generator's GenItem plus a display label. */
export function toDisplayItem(item: WardrobeItemRow): GenItem & { label: string } {
  return {
    id: item.id,
    category: item.category,
    season: item.season,
    occasion: item.occasion,
    laundryStatus: item.laundry_status,
    label: itemLabel(item),
  }
}
