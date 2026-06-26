import { describe, it, expect } from 'vitest'
import {
  generateOutfit,
  type GenItem,
} from '@/components/wardrobe/outfit-gen'

// Helper to build a GenItem with sensible defaults.
function item(partial: Partial<GenItem> & Pick<GenItem, 'id' | 'category'>): GenItem {
  return {
    season: [],
    occasion: [],
    laundryStatus: 'clean',
    ...partial,
  }
}

const wardrobe: GenItem[] = [
  item({ id: 'top-a', category: 'top', season: ['summer'], occasion: ['casual'] }),
  item({ id: 'top-b', category: 'top', season: ['winter'], occasion: ['work'] }),
  item({ id: 'bot-a', category: 'bottom', season: ['summer'], occasion: ['casual'] }),
  item({ id: 'bot-b', category: 'bottom', season: ['winter'], occasion: ['work'] }),
  item({ id: 'shoe-a', category: 'shoes', occasion: ['casual', 'work'] }),
  item({ id: 'out-a', category: 'outerwear', season: ['winter'] }),
  item({ id: 'acc-a', category: 'accessory' }),
]

describe('generateOutfit', () => {
  it('picks one item per required category (default set)', () => {
    const outfit = generateOutfit(wardrobe)
    // Default required categories: top, bottom, shoes, outerwear, accessory.
    expect(outfit.itemIds).toHaveLength(5)
    expect(outfit.missingCategories).toEqual([])
    // One per category.
    const cats = outfit.items.map((i) => i.category)
    expect(new Set(cats).size).toBe(cats.length)
  })

  it('is deterministic — same inputs + seed yield the same outfit', () => {
    const a = generateOutfit(wardrobe, {}, { seed: 3 })
    const b = generateOutfit(wardrobe, {}, { seed: 3 })
    expect(a.itemIds).toEqual(b.itemIds)
  })

  it('is independent of input ordering (sorted by id internally)', () => {
    const shuffled = [...wardrobe].reverse()
    const a = generateOutfit(wardrobe, {}, { seed: 1 })
    const b = generateOutfit(shuffled, {}, { seed: 1 })
    expect(a.itemIds).toEqual(b.itemIds)
  })

  it('re-rolls deterministically when the seed changes', () => {
    // Two tops available, so the top slot must vary between seed 0 and seed 1.
    const s0 = generateOutfit(wardrobe, {}, { seed: 0 })
    const s1 = generateOutfit(wardrobe, {}, { seed: 1 })
    const top0 = s0.items.find((i) => i.category === 'top')!.id
    const top1 = s1.items.find((i) => i.category === 'top')!.id
    expect(top0).not.toBe(top1)
  })

  it('wraps the seed so large seeds stay in range', () => {
    const big = generateOutfit(wardrobe, {}, { seed: 999 })
    expect(big.itemIds).toHaveLength(5)
    // Every chosen id is a real wardrobe id.
    const ids = new Set(wardrobe.map((i) => i.id))
    for (const id of big.itemIds) expect(ids.has(id)).toBe(true)
  })

  it('handles negative seeds without crashing (non-negative modulo)', () => {
    const neg = generateOutfit(wardrobe, {}, { seed: -1 })
    expect(neg.itemIds).toHaveLength(5)
  })

  it('always excludes in_wash items', () => {
    const withWash: GenItem[] = [
      item({ id: 'top-clean', category: 'top' }),
      item({ id: 'top-wash', category: 'top', laundryStatus: 'in_wash' }),
    ]
    // Even across many seeds, the in_wash top is never chosen.
    for (let seed = 0; seed < 5; seed++) {
      const outfit = generateOutfit(withWash, {}, { seed, requiredCategories: ['top'] })
      expect(outfit.itemIds).toEqual(['top-clean'])
    }
  })

  it('excludes ids passed in excludeIds (e.g. packed for a trip)', () => {
    const outfit = generateOutfit(
      wardrobe,
      {},
      { excludeIds: ['top-a', 'top-b'], requiredCategories: ['top'] },
    )
    expect(outfit.itemIds).toEqual([])
    expect(outfit.missingCategories).toEqual(['top'])
  })

  it('filters by occasion (case-insensitive)', () => {
    const outfit = generateOutfit(
      wardrobe,
      { occasion: 'WORK' },
      { requiredCategories: ['top', 'bottom'] },
    )
    expect(outfit.itemIds.sort()).toEqual(['bot-b', 'top-b'])
  })

  it('filters by season', () => {
    const outfit = generateOutfit(
      wardrobe,
      { season: 'summer' },
      { requiredCategories: ['top', 'bottom'] },
    )
    expect(outfit.itemIds.sort()).toEqual(['bot-a', 'top-a'])
  })

  it('reports missing categories rather than throwing when a slot is empty', () => {
    const sparse: GenItem[] = [item({ id: 'top-only', category: 'top' })]
    const outfit = generateOutfit(sparse, {}, { requiredCategories: ['top', 'shoes'] })
    expect(outfit.itemIds).toEqual(['top-only'])
    expect(outfit.missingCategories).toEqual(['shoes'])
  })

  it('combines occasion + laundry + exclude filters together', () => {
    const items: GenItem[] = [
      item({ id: 'a', category: 'top', occasion: ['formal'], laundryStatus: 'clean' }),
      item({ id: 'b', category: 'top', occasion: ['formal'], laundryStatus: 'in_wash' }),
      item({ id: 'c', category: 'top', occasion: ['casual'], laundryStatus: 'clean' }),
      item({ id: 'd', category: 'top', occasion: ['formal'], laundryStatus: 'clean' }),
    ]
    const outfit = generateOutfit(
      items,
      { occasion: 'formal' },
      { excludeIds: ['d'], requiredCategories: ['top'] },
    )
    // 'b' is in_wash, 'c' is casual, 'd' excluded → only 'a' remains.
    expect(outfit.itemIds).toEqual(['a'])
  })
})
