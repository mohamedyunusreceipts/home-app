import { describe, it, expect } from 'vitest'
import {
  generateGroceryList,
  type IngredientInput,
  type PantryInput,
} from '@/components/food/grocery-gen'

describe('generateGroceryList', () => {
  it('emits a quantified ingredient with no pantry stock', () => {
    const out = generateGroceryList([{ name: 'Flour', qty: 500, unit: 'g' }], [])
    expect(out).toEqual([{ name: 'Flour', qty: 500, unit: 'g' }])
  })

  it('subtracts pantry stock from the required quantity', () => {
    const ingredients: IngredientInput[] = [{ name: 'Milk', qty: 2, unit: 'l' }]
    const pantry: PantryInput[] = [{ name: 'Milk', qty: 0.5, unit: 'l' }]
    expect(generateGroceryList(ingredients, pantry)).toEqual([
      { name: 'Milk', qty: 1.5, unit: 'l' },
    ])
  })

  it('drops an item the pantry fully covers', () => {
    const out = generateGroceryList(
      [{ name: 'Eggs', qty: 6, unit: '' }],
      [{ name: 'Eggs', qty: 12, unit: '' }],
    )
    expect(out).toEqual([])
  })

  it('drops an item the pantry exactly covers (shortfall of zero)', () => {
    const out = generateGroceryList(
      [{ name: 'Butter', qty: 250, unit: 'g' }],
      [{ name: 'Butter', qty: 250, unit: 'g' }],
    )
    expect(out).toEqual([])
  })

  it('merges duplicate ingredients by name+unit, summing quantities', () => {
    const ingredients: IngredientInput[] = [
      { name: 'Onion', qty: 2, unit: 'ea' },
      { name: 'onion', qty: 1, unit: 'EA' }, // case-insensitive match
    ]
    expect(generateGroceryList(ingredients, [])).toEqual([
      { name: 'Onion', qty: 3, unit: 'ea' },
    ])
  })

  it('treats different units as separate items', () => {
    const ingredients: IngredientInput[] = [
      { name: 'Tomato', qty: 3, unit: 'ea' },
      { name: 'Tomato', qty: 400, unit: 'g' },
    ]
    const out = generateGroceryList(ingredients, [])
    expect(out).toHaveLength(2)
    expect(out).toContainEqual({ name: 'Tomato', qty: 3, unit: 'ea' })
    expect(out).toContainEqual({ name: 'Tomato', qty: 400, unit: 'g' })
  })

  it('emits an unquantified ingredient when the pantry lacks it', () => {
    const out = generateGroceryList([{ name: 'Salt', qty: null, unit: null }], [])
    expect(out).toEqual([{ name: 'Salt', qty: null, unit: null }])
  })

  it('covers an unquantified ingredient if the pantry lists it at all', () => {
    const out = generateGroceryList(
      [{ name: 'Salt', qty: null, unit: null }],
      [{ name: 'Salt', qty: null, unit: null }],
    )
    expect(out).toEqual([])
  })

  it('does not let unquantified pantry stock satisfy a numeric requirement', () => {
    const out = generateGroceryList(
      [{ name: 'Sugar', qty: 200, unit: 'g' }],
      [{ name: 'Sugar', qty: null, unit: 'g' }],
    )
    expect(out).toEqual([{ name: 'Sugar', qty: 200, unit: 'g' }])
  })

  it('ignores blank ingredient names', () => {
    const out = generateGroceryList(
      [
        { name: '  ', qty: 5, unit: 'g' },
        { name: 'Rice', qty: 1, unit: 'kg' },
      ],
      [],
    )
    expect(out).toEqual([{ name: 'Rice', qty: 1, unit: 'kg' }])
  })

  it('handles a realistic week: merge, net against pantry, drop covered', () => {
    const ingredients: IngredientInput[] = [
      { name: 'Chicken', qty: 1, unit: 'kg' },
      { name: 'Rice', qty: 500, unit: 'g' },
      { name: 'Rice', qty: 300, unit: 'g' }, // merges → 800g
      { name: 'Onion', qty: 3, unit: 'ea' },
      { name: 'Garlic', qty: null, unit: null },
    ]
    const pantry: PantryInput[] = [
      { name: 'Rice', qty: 1000, unit: 'g' }, // fully covers 800g → dropped
      { name: 'Onion', qty: 1, unit: 'ea' }, // 3 - 1 = 2 needed
      { name: 'Garlic', qty: null, unit: null }, // covers the unquantified garlic
    ]
    const out = generateGroceryList(ingredients, pantry)
    expect(out).toContainEqual({ name: 'Chicken', qty: 1, unit: 'kg' })
    expect(out).toContainEqual({ name: 'Onion', qty: 2, unit: 'ea' })
    expect(out).not.toContainEqual(expect.objectContaining({ name: 'Rice' }))
    expect(out).not.toContainEqual(expect.objectContaining({ name: 'Garlic' }))
    expect(out).toHaveLength(2)
  })

  it('rounds float dust to 3 decimals', () => {
    const out = generateGroceryList(
      [{ name: 'Oil', qty: 0.3, unit: 'l' }],
      [{ name: 'Oil', qty: 0.1, unit: 'l' }],
    )
    expect(out).toEqual([{ name: 'Oil', qty: 0.2, unit: 'l' }])
  })
})
