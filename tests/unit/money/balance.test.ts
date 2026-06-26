import { describe, it, expect } from 'vitest'
import {
  computeWhoOwesWho,
  type BalanceExpense,
  type BalanceSplit,
} from '@/components/money/balance'
import { computeSplits } from '@/components/money/split'

const ME = 'me'
const PARTNER = 'partner'

describe('computeWhoOwesWho', () => {
  it('is settled with no activity', () => {
    const r = computeWhoOwesWho([], [], [ME, PARTNER])
    expect(r.amount).toBe(0)
    expect(r.debtorUserId).toBeNull()
    expect(r.creditorUserId).toBeNull()
    expect(r.netByUser).toEqual({ me: 0, partner: 0 })
  })

  it('partner owes me half when I pay for an equal split', () => {
    const expenses: BalanceExpense[] = [{ id: 'e1', paidByUserId: ME, amount: 100 }]
    const splits: BalanceSplit[] = computeSplits(100, 'equal', {
      meUserId: ME,
      partnerUserId: PARTNER,
    }).map((s) => ({ expenseId: 'e1', userId: s.userId, shareAmount: s.shareAmount }))

    const r = computeWhoOwesWho(expenses, splits, [ME, PARTNER])
    expect(r.debtorUserId).toBe(PARTNER)
    expect(r.creditorUserId).toBe(ME)
    expect(r.amount).toBe(50)
    expect(r.netByUser[ME]).toBe(50)
    expect(r.netByUser[PARTNER]).toBe(-50)
  })

  it('me_only expense I paid leaves us settled', () => {
    const expenses: BalanceExpense[] = [{ id: 'e1', paidByUserId: ME, amount: 80 }]
    const splits: BalanceSplit[] = [{ expenseId: 'e1', userId: ME, shareAmount: 80 }]
    const r = computeWhoOwesWho(expenses, splits, [ME, PARTNER])
    expect(r.amount).toBe(0)
    expect(r.debtorUserId).toBeNull()
  })

  it('I owe partner when they paid for something that is all mine', () => {
    const expenses: BalanceExpense[] = [{ id: 'e1', paidByUserId: PARTNER, amount: 60 }]
    const splits: BalanceSplit[] = [{ expenseId: 'e1', userId: ME, shareAmount: 60 }]
    const r = computeWhoOwesWho(expenses, splits, [ME, PARTNER])
    expect(r.debtorUserId).toBe(ME)
    expect(r.creditorUserId).toBe(PARTNER)
    expect(r.amount).toBe(60)
  })

  it('nets multiple expenses across both payers into one running balance', () => {
    // e1: I pay 100, split equal → partner owes me 50.
    // e2: partner pays 40, split equal → I owe partner 20.
    // Net: partner owes me 30.
    const expenses: BalanceExpense[] = [
      { id: 'e1', paidByUserId: ME, amount: 100 },
      { id: 'e2', paidByUserId: PARTNER, amount: 40 },
    ]
    const splits: BalanceSplit[] = [
      { expenseId: 'e1', userId: ME, shareAmount: 50 },
      { expenseId: 'e1', userId: PARTNER, shareAmount: 50 },
      { expenseId: 'e2', userId: ME, shareAmount: 20 },
      { expenseId: 'e2', userId: PARTNER, shareAmount: 20 },
    ]
    const r = computeWhoOwesWho(expenses, splits, [ME, PARTNER])
    expect(r.debtorUserId).toBe(PARTNER)
    expect(r.creditorUserId).toBe(ME)
    expect(r.amount).toBe(30)
  })

  it('handles odd-cent equal splits so the balance reconciles', () => {
    const split = computeSplits(100.01, 'equal', { meUserId: ME, partnerUserId: PARTNER })
    const expenses: BalanceExpense[] = [{ id: 'e1', paidByUserId: ME, amount: 100.01 }]
    const splits: BalanceSplit[] = split.map((s) => ({
      expenseId: 'e1',
      userId: s.userId,
      shareAmount: s.shareAmount,
    }))
    const r = computeWhoOwesWho(expenses, splits, [ME, PARTNER])
    // Partner's share was 50.00, mine 50.01; partner owes me 50.00.
    expect(r.debtorUserId).toBe(PARTNER)
    expect(r.amount).toBe(50)
  })

  it('seeds both members at zero even when only one has activity', () => {
    const r = computeWhoOwesWho(
      [{ id: 'e1', paidByUserId: ME, amount: 10 }],
      [{ expenseId: 'e1', userId: ME, shareAmount: 10 }],
      [ME, PARTNER],
    )
    expect(r.netByUser[PARTNER]).toBe(0)
  })
})
