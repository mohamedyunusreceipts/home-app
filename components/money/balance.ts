// Pure "who owes who" balance logic for the Money module (design spec §9.1).
//
// The balance between the two members is a single running number, recomputed
// live from expenses + their splits (never stored). For each expense:
//   - the payer fronted the whole `amount`;
//   - each member ultimately owes their `share_amount`.
// So each member's net position = (what they paid) − (what they owed). In a
// two-person household those two nets are equal and opposite, which we collapse
// into one directional statement: "X owes Y R Z".
//
// Side-effect free and deterministic — unit-tested in tests/unit/money/balance.test.ts.

import { round2 } from './split'

/** Minimal expense shape the balance needs: who paid, and how much. */
export interface BalanceExpense {
  id: string
  paidByUserId: string
  amount: number
}

/** Minimal split shape: which expense, which member, their share. */
export interface BalanceSplit {
  expenseId: string
  userId: string
  shareAmount: number
}

/** The computed running balance between the two members. */
export interface WhoOwesWho {
  /** Net position per user id: positive = is owed money, negative = owes money. */
  netByUser: Record<string, number>
  /** The member who owes (null when settled). */
  debtorUserId: string | null
  /** The member who is owed (null when settled). */
  creditorUserId: string | null
  /** The positive amount the debtor owes the creditor (0 when settled). */
  amount: number
}

/**
 * Compute the running balance between the (up to two) members.
 *
 * `memberUserIds` pins the result to the household's two members so a fully
 * settled household still reports a stable `netByUser` shape (both at 0).
 * Members beyond the listed ones still accrue a net if they appear in the data.
 */
export function computeWhoOwesWho(
  expenses: readonly BalanceExpense[],
  splits: readonly BalanceSplit[],
  memberUserIds: readonly string[] = [],
): WhoOwesWho {
  const net: Record<string, number> = {}
  const bump = (userId: string, delta: number) => {
    net[userId] = round2((net[userId] ?? 0) + delta)
  }

  // Seed known members at 0 so they always appear.
  for (const id of memberUserIds) {
    if (!(id in net)) net[id] = 0
  }

  // Credit each payer with what they fronted.
  for (const e of expenses) {
    if (!Number.isFinite(e.amount)) continue
    bump(e.paidByUserId, e.amount)
  }

  // Debit each member by the share they owed.
  for (const s of splits) {
    if (!Number.isFinite(s.shareAmount)) continue
    bump(s.userId, -s.shareAmount)
  }

  // Resolve the single directional statement. The most-negative member is the
  // debtor; the most-positive is the creditor. For a balanced two-person
  // household these mirror each other.
  let debtorUserId: string | null = null
  let creditorUserId: string | null = null
  let minNet = 0
  let maxNet = 0
  for (const [userId, value] of Object.entries(net)) {
    if (value < minNet) {
      minNet = value
      debtorUserId = userId
    }
    if (value > maxNet) {
      maxNet = value
      creditorUserId = userId
    }
  }

  // The settle-up amount is the magnitude of the imbalance (rounded).
  const amount = round2(Math.min(-minNet, maxNet))

  if (amount <= 0 || debtorUserId == null || creditorUserId == null) {
    return { netByUser: net, debtorUserId: null, creditorUserId: null, amount: 0 }
  }

  return { netByUser: net, debtorUserId, creditorUserId, amount }
}
