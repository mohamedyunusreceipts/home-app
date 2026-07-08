import { describe, it, expect } from 'vitest'
import {
  computeOutstanding,
  type SettlementRow,
} from '@/components/money/settlement'
import { computeSplits } from '@/components/money/split'
import type { BalanceExpense, BalanceSplit } from '@/components/money/balance'

const ME = 'me'
const PARTNER = 'partner'

/** Helper: one equal-split expense paid by `payer`. */
function equalExpense(payer: string, amount: number): {
  expenses: BalanceExpense[]
  splits: BalanceSplit[]
} {
  const shares = computeSplits(amount, 'equal', { meUserId: ME, partnerUserId: PARTNER })
  return {
    expenses: [{ id: 'e1', paidByUserId: payer, amount }],
    splits: shares.map((s) => ({ expenseId: 'e1', userId: s.userId, shareAmount: s.shareAmount })),
  }
}

describe('computeOutstanding', () => {
  it('splits only — partner owes me half with no settlements', () => {
    const { expenses, splits } = equalExpense(ME, 100)
    const r = computeOutstanding(expenses, splits, [], [ME, PARTNER])
    expect(r.owerId).toBe(PARTNER)
    expect(r.owedId).toBe(ME)
    expect(r.outstanding).toBe(50)
    expect(r.originalOwed).toBe(50)
  })

  it('is square with no activity at all', () => {
    const r = computeOutstanding([], [], [], [ME, PARTNER])
    expect(r.owerId).toBeNull()
    expect(r.owedId).toBeNull()
    expect(r.outstanding).toBe(0)
  })

  it('splits minus a partial settlement reduces the outstanding', () => {
    // Partner owes me 50; partner repays 20 → 30 left.
    const { expenses, splits } = equalExpense(ME, 100)
    const settlements: SettlementRow[] = [{ fromUserId: PARTNER, toUserId: ME, amount: 20 }]
    const r = computeOutstanding(expenses, splits, settlements, [ME, PARTNER])
    expect(r.owerId).toBe(PARTNER)
    expect(r.owedId).toBe(ME)
    expect(r.outstanding).toBe(30)
    expect(r.originalOwed).toBe(50)
  })

  it('a settlement equal to the debt squares the balance', () => {
    const { expenses, splits } = equalExpense(ME, 100)
    const settlements: SettlementRow[] = [{ fromUserId: PARTNER, toUserId: ME, amount: 50 }]
    const r = computeOutstanding(expenses, splits, settlements, [ME, PARTNER])
    expect(r.outstanding).toBe(0)
    expect(r.owerId).toBeNull()
    expect(r.owedId).toBeNull()
  })

  it('over-settlement flips the direction (creditor now owes the surplus)', () => {
    // Partner owes me 50 but repays 80 → I now owe partner 30.
    const { expenses, splits } = equalExpense(ME, 100)
    const settlements: SettlementRow[] = [{ fromUserId: PARTNER, toUserId: ME, amount: 80 }]
    const r = computeOutstanding(expenses, splits, settlements, [ME, PARTNER])
    expect(r.owerId).toBe(ME)
    expect(r.owedId).toBe(PARTNER)
    expect(r.outstanding).toBe(30)
    // No debt exists in the new direction from splits, so originalOwed is 0.
    expect(r.originalOwed).toBe(0)
  })

  it('both-direction settlements net correctly', () => {
    // Partner owes me 50. Partner pays 40, then I pay partner 10 back.
    // Net repaid to me = 40 - 10 = 30 → 20 left, partner still owes me.
    const { expenses, splits } = equalExpense(ME, 100)
    const settlements: SettlementRow[] = [
      { fromUserId: PARTNER, toUserId: ME, amount: 40 },
      { fromUserId: ME, toUserId: PARTNER, amount: 10 },
    ]
    const r = computeOutstanding(expenses, splits, settlements, [ME, PARTNER])
    expect(r.owerId).toBe(PARTNER)
    expect(r.owedId).toBe(ME)
    expect(r.outstanding).toBe(20)
  })

  it('a settlement with no split debt creates a debt the other way', () => {
    // No expenses; partner pays me 25 → I now owe partner 25.
    const settlements: SettlementRow[] = [{ fromUserId: PARTNER, toUserId: ME, amount: 25 }]
    const r = computeOutstanding([], [], settlements, [ME, PARTNER])
    expect(r.owerId).toBe(ME)
    expect(r.owedId).toBe(PARTNER)
    expect(r.outstanding).toBe(25)
  })

  it('handles odd-cent debts without float drift', () => {
    // I pay 100.01 equal → partner owes me 50.00. Partner repays 50.00 → square.
    const { expenses, splits } = equalExpense(ME, 100.01)
    const settlements: SettlementRow[] = [{ fromUserId: PARTNER, toUserId: ME, amount: 50 }]
    const r = computeOutstanding(expenses, splits, settlements, [ME, PARTNER])
    expect(r.outstanding).toBe(0)
  })
})
