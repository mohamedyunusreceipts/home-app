// Pure budget-progress helper for the Money module (design spec §9.1).
//
// Compares this month's spend per category against the set budget limits and
// flags any category that has crossed the 80% warning threshold. Side-effect
// free; used by the dashboard + budget pages and unit-tested.

import { round2 } from './split'

export const WARNING_THRESHOLD = 0.8

export interface BudgetLimit {
  category: string
  limitAmount: number
}

export interface CategorySpend {
  category: string
  amount: number
}

export interface BudgetProgress {
  category: string
  limit: number
  spent: number
  /** Fraction of the limit used (0..∞). 0 when there's no positive limit. */
  ratio: number
  /** True once spend exceeds WARNING_THRESHOLD of the limit. */
  warning: boolean
  /** True once spend exceeds the limit outright. */
  over: boolean
}

/**
 * Build per-category budget progress. Every category that has either a budget
 * limit or recorded spend appears in the result, sorted by descending ratio so
 * the most-at-risk categories surface first.
 */
export function budgetProgress(
  limits: readonly BudgetLimit[],
  spend: readonly CategorySpend[],
): BudgetProgress[] {
  const spentByCat = new Map<string, number>()
  for (const s of spend) {
    spentByCat.set(s.category, round2((spentByCat.get(s.category) ?? 0) + s.amount))
  }
  const limitByCat = new Map<string, number>()
  for (const l of limits) {
    limitByCat.set(l.category, l.limitAmount)
  }

  const categories = new Set<string>([...spentByCat.keys(), ...limitByCat.keys()])
  const rows: BudgetProgress[] = []
  for (const category of categories) {
    const limit = limitByCat.get(category) ?? 0
    const spent = spentByCat.get(category) ?? 0
    const ratio = limit > 0 ? spent / limit : 0
    rows.push({
      category,
      limit,
      spent,
      ratio,
      warning: limit > 0 && ratio > WARNING_THRESHOLD,
      over: limit > 0 && spent > limit,
    })
  }

  rows.sort((a, b) => b.ratio - a.ratio || a.category.localeCompare(b.category))
  return rows
}

/** True if any budgeted category has crossed the warning threshold. */
export function anyBudgetWarning(rows: readonly BudgetProgress[]): boolean {
  return rows.some((r) => r.warning)
}
