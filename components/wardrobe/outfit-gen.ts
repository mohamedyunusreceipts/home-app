// Deterministic outfit generator (spec §9.6).
//
// PURE — no I/O, no Date.now(), and crucially NO Math.random (unavailable in the
// target runtime and non-deterministic anyway). Re-rolls are driven by an
// integer `seed`: the same items + filters + seed always yield the same outfit,
// and bumping the seed walks deterministically through the available options.
//
// Lives in components/wardrobe to keep the module self-contained (no cross-module
// imports). Unit-tested in tests/unit/wardrobe/outfit-gen.test.ts.

export type WardrobeCategory =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'shoes'
  | 'outerwear'
  | 'accessory'
  | 'underwear'

export type LaundryStatus = 'clean' | 'worn' | 'in_wash'

/** Minimal item shape the generator needs — a subset of a wardrobe_items row. */
export type GenItem = {
  id: string
  category: WardrobeCategory
  season: string[]
  occasion: string[]
  laundryStatus: LaundryStatus
}

export type OutfitFilters = {
  /** Match only items tagged with this occasion (case-insensitive). */
  occasion?: string | null
  /** Match only items tagged with this season (case-insensitive). */
  season?: string | null
}

export type GenerateOptions = {
  /**
   * Re-roll seed. 0 picks the first candidate per category; each increment walks
   * deterministically to the next candidate (wrapping per category). Defaults 0.
   */
  seed?: number
  /**
   * Item ids to exclude — e.g. items already in an active trip's packing list.
   * Items with laundryStatus 'in_wash' are ALWAYS excluded regardless of this.
   */
  excludeIds?: readonly string[]
  /**
   * Categories one item is required from, in order. A "complete" outfit needs
   * one of each. Defaults to a sensible everyday set.
   */
  requiredCategories?: readonly WardrobeCategory[]
}

export type GeneratedOutfit = {
  /** One chosen item id per category that had a candidate, in category order. */
  itemIds: string[]
  /** The chosen item per category (parallel to the required-category order). */
  items: GenItem[]
  /** Categories that had no eligible candidate (the outfit is incomplete). */
  missingCategories: WardrobeCategory[]
}

const DEFAULT_REQUIRED: readonly WardrobeCategory[] = [
  'top',
  'bottom',
  'shoes',
  'outerwear',
  'accessory',
]

function norm(value: string): string {
  return value.trim().toLowerCase()
}

function matchesFilters(item: GenItem, filters: OutfitFilters): boolean {
  if (filters.occasion) {
    const want = norm(filters.occasion)
    if (!item.occasion.some((o) => norm(o) === want)) return false
  }
  if (filters.season) {
    const want = norm(filters.season)
    if (!item.season.some((s) => norm(s) === want)) return false
  }
  return true
}

/**
 * Build the pool of eligible items for a category: matches filters, not in the
 * exclude set, never 'in_wash'. Sorted by id for a stable, deterministic order
 * independent of input ordering.
 */
function candidatesFor(
  items: readonly GenItem[],
  category: WardrobeCategory,
  filters: OutfitFilters,
  excluded: ReadonlySet<string>,
): GenItem[] {
  return items
    .filter(
      (it) =>
        it.category === category &&
        it.laundryStatus !== 'in_wash' &&
        !excluded.has(it.id) &&
        matchesFilters(it, filters),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Generate one outfit: pick a single item per required category. Deterministic —
 * the same inputs always produce the same outfit. Incrementing `seed` re-rolls,
 * walking each category's candidate list by `seed` positions (wrapping). A
 * category with no eligible candidate is reported in `missingCategories` and
 * simply omitted from the picks (a top + shoes is still a useful suggestion).
 */
export function generateOutfit(
  items: readonly GenItem[],
  filters: OutfitFilters = {},
  options: GenerateOptions = {},
): GeneratedOutfit {
  const seed = Number.isFinite(options.seed) ? Math.trunc(options.seed as number) : 0
  const excluded = new Set(options.excludeIds ?? [])
  const required = options.requiredCategories ?? DEFAULT_REQUIRED

  const itemIds: string[] = []
  const chosen: GenItem[] = []
  const missingCategories: WardrobeCategory[] = []

  required.forEach((category, categoryIndex) => {
    const pool = candidatesFor(items, category, filters, excluded)
    if (pool.length === 0) {
      missingCategories.push(category)
      return
    }
    // Offset each category by its index so re-rolls vary the whole outfit, not
    // just one slot. Non-negative modulo keeps negative seeds well-defined.
    const raw = seed + categoryIndex
    const idx = ((raw % pool.length) + pool.length) % pool.length
    const pick = pool[idx]!
    itemIds.push(pick.id)
    chosen.push(pick)
  })

  return { itemIds, items: chosen, missingCategories }
}
