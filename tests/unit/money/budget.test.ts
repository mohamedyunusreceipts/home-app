import { describe, it, expect } from 'vitest'
import { budgetProgress, anyBudgetWarning } from '@/components/money/budget'

describe('budgetProgress', () => {
  it('flags a warning above 80% of the limit', () => {
    const rows = budgetProgress(
      [{ category: 'Groceries', limitAmount: 1000 }],
      [{ category: 'Groceries', amount: 850 }],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.ratio).toBeCloseTo(0.85, 5)
    expect(rows[0]!.warning).toBe(true)
    expect(rows[0]!.over).toBe(false)
  })

  it('does not warn at or below 80%', () => {
    const rows = budgetProgress(
      [{ category: 'Dining', limitAmount: 1000 }],
      [{ category: 'Dining', amount: 800 }],
    )
    expect(rows[0]!.warning).toBe(false)
  })

  it('marks over when spend exceeds the limit', () => {
    const rows = budgetProgress(
      [{ category: 'Rent', limitAmount: 5000 }],
      [{ category: 'Rent', amount: 5200 }],
    )
    expect(rows[0]!.over).toBe(true)
    expect(rows[0]!.warning).toBe(true)
  })

  it('aggregates multiple spend rows in the same category', () => {
    const rows = budgetProgress(
      [{ category: 'Transport', limitAmount: 1000 }],
      [
        { category: 'Transport', amount: 300 },
        { category: 'Transport', amount: 250 },
      ],
    )
    expect(rows[0]!.spent).toBe(550)
  })

  it('includes spend in categories with no budget (ratio 0, no warning)', () => {
    const rows = budgetProgress([], [{ category: 'Personal', amount: 999 }])
    expect(rows[0]!.limit).toBe(0)
    expect(rows[0]!.ratio).toBe(0)
    expect(rows[0]!.warning).toBe(false)
  })

  it('sorts most-at-risk first', () => {
    const rows = budgetProgress(
      [
        { category: 'A', limitAmount: 1000 },
        { category: 'B', limitAmount: 1000 },
      ],
      [
        { category: 'A', amount: 200 },
        { category: 'B', amount: 950 },
      ],
    )
    expect(rows[0]!.category).toBe('B')
  })
})

describe('anyBudgetWarning', () => {
  it('is true when any category warns', () => {
    const rows = budgetProgress(
      [
        { category: 'A', limitAmount: 1000 },
        { category: 'B', limitAmount: 1000 },
      ],
      [
        { category: 'A', amount: 100 },
        { category: 'B', amount: 900 },
      ],
    )
    expect(anyBudgetWarning(rows)).toBe(true)
  })

  it('is false when nothing warns', () => {
    const rows = budgetProgress(
      [{ category: 'A', limitAmount: 1000 }],
      [{ category: 'A', amount: 100 }],
    )
    expect(anyBudgetWarning(rows)).toBe(false)
  })
})
