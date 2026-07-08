// Pure settle-up math for the Money module.
//
// The split-derived balance (components/balance.ts) tells us who owes who purely
// from expenses + their splits. Once repayments (`settlements`) exist, the real
// outstanding balance is that split-derived debt MINUS what the ower has already
// paid the creditor, PLUS anything the creditor paid back the other way (which
// only ever reduces or flips the debt).
//
// This module folds settlements into the split balance and produces a single
// directional result: `{ owerId, owedId, outstanding }` with `outstanding >= 0`.
// It is side-effect free and deterministic so it can be unit-tested in isolation
// (tests/unit/money/settlement.test.ts) and reused by the server actions + cron.

import { round2 } from './split'
import { computeWhoOwesWho, type BalanceExpense, type BalanceSplit } from './balance'

/** Minimal settlement shape the math needs: a repayment from one member to the other. */
export interface SettlementRow {
  fromUserId: string
  toUserId: string
  amount: number
}

/** The net outstanding balance after applying repayments to the split debt. */
export interface OutstandingBalance {
  /** The member who still owes (null when square). */
  owerId: string | null
  /** The member who is still owed (null when square). */
  owedId: string | null
  /** The positive amount still outstanding (0 = square). */
  outstanding: number
  /**
   * The original split-derived debt before any settlements, from the SAME
   * direction as the current outstanding balance (useful for a progress bar).
   * When settlements have flipped the direction, this is the (now-repaid)
   * portion of the debt in the new direction and will be 0.
   */
  originalOwed: number
}

/**
 * Sum the net repayment flow between two users as (a→b) minus (b→a). A positive
 * result means, on net, `a` has paid `b`.
 */
function netPaid(settlements: readonly SettlementRow[], a: string, b: string): number {
  let total = 0
  for (const s of settlements) {
    if (!Number.isFinite(s.amount)) continue
    if (s.fromUserId === a && s.toUserId === b) total += s.amount
    else if (s.fromUserId === b && s.toUserId === a) total -= s.amount
  }
  return round2(total)
}

/**
 * Compute the outstanding balance between the (up to two) household members,
 * folding repayments into the split-derived "who owes who" debt.
 *
 * Algorithm:
 *   1. Derive the split-only debt (owerId owes owedId `debt`).
 *   2. Subtract the ower's net repayments to the creditor. Reverse-direction
 *      repayments count negatively in that net, so they add back to the debt —
 *      which correctly means the creditor now owes the ower.
 *   3. If the remaining amount is negative, the direction has flipped: the former
 *      creditor is now the ower for the overpaid amount.
 */
export function computeOutstanding(
  expenses: readonly BalanceExpense[],
  splits: readonly BalanceSplit[],
  settlements: readonly SettlementRow[],
  memberUserIds: readonly string[] = [],
): OutstandingBalance {
  const base = computeWhoOwesWho(expenses, splits, memberUserIds)

  // No split-derived debt: any settlements simply create a debt the other way.
  if (base.debtorUserId == null || base.creditorUserId == null || base.amount <= 0) {
    // With no baseline direction we can still resolve a debt if the two known
    // members have a net repayment between them (e.g. someone paid ahead).
    const [a, b] = memberUserIds
    if (a != null && b != null) {
      const paid = netPaid(settlements, a, b) // a paid b, on net
      if (paid > 0) {
        // a overpaid b with no debt → b now owes a.
        return { owerId: b, owedId: a, outstanding: paid, originalOwed: 0 }
      }
      if (paid < 0) {
        return { owerId: a, owedId: b, outstanding: round2(-paid), originalOwed: 0 }
      }
    }
    return { owerId: null, owedId: null, outstanding: 0, originalOwed: 0 }
  }

  const ower = base.debtorUserId
  const owed = base.creditorUserId
  const debt = base.amount

  // What the ower has paid the creditor, net of any reverse repayments.
  const paidToCreditor = netPaid(settlements, ower, owed)
  const remaining = round2(debt - paidToCreditor)

  if (remaining > 0) {
    // Still owing in the original direction.
    return { owerId: ower, owedId: owed, outstanding: remaining, originalOwed: debt }
  }
  if (remaining < 0) {
    // Overpaid — the direction flips; the former creditor now owes the surplus.
    return { owerId: owed, owedId: ower, outstanding: round2(-remaining), originalOwed: 0 }
  }
  // Exactly square.
  return { owerId: null, owedId: null, outstanding: 0, originalOwed: debt }
}
