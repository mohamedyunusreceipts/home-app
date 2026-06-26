// Pure expense-split logic for the Money module (design spec §9.1).
//
// Given an expense amount, a split_type, and the two household members, produce
// the per-member `expense_splits` rows (share_amount each). Also exposes the
// pure "who owes who" balance calculation over a set of expenses + their splits.
//
// Everything here is deterministic and side-effect free so it can be unit-tested
// in isolation (tests/unit/money/split.test.ts) and reused by the server actions.

export type SplitType = 'equal' | 'me_only' | 'partner_only' | 'custom_amount'

/** The two members of a household, by user id. `me` is the acting/paying user. */
export interface SplitMembers {
  /** The acting user (the one whose form this is — typically the payer). */
  meUserId: string
  /** The other household member. */
  partnerUserId: string
}

/** A computed share for one member — maps directly to an `expense_splits` row. */
export interface SplitShare {
  userId: string
  shareAmount: number
}

/** Optional custom amounts (only used when split_type === 'custom_amount'). */
export interface CustomAmounts {
  meAmount: number
  partnerAmount: number
}

/** Round to 2 decimal places, avoiding binary-float drift (e.g. 1.005 → 1.01). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Compute the split shares for an expense.
 *
 * - `equal`           → halved, with any odd cent assigned to `me` so the shares
 *                       always sum back to the exact total.
 * - `me_only`         → the acting user bears the whole amount.
 * - `partner_only`    → the partner bears the whole amount.
 * - `custom_amount`   → uses the supplied `custom` amounts; they MUST sum to the
 *                       total (validated here).
 *
 * @throws {Error} on a negative/non-finite amount, a missing/invalid custom split,
 *                 or custom amounts that don't reconcile to the total.
 */
export function computeSplits(
  amount: number,
  splitType: SplitType,
  members: SplitMembers,
  custom?: CustomAmounts,
): SplitShare[] {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('computeSplits: amount must be a non-negative finite number.')
  }
  const total = round2(amount)
  const { meUserId, partnerUserId } = members

  switch (splitType) {
    case 'me_only':
      return [{ userId: meUserId, shareAmount: total }]

    case 'partner_only':
      return [{ userId: partnerUserId, shareAmount: total }]

    case 'equal': {
      // Half, with the odd cent (if any) going to `me` so shares sum to total.
      const half = round2(total / 2)
      const otherHalf = round2(total - half)
      return [
        { userId: meUserId, shareAmount: half },
        { userId: partnerUserId, shareAmount: otherHalf },
      ]
    }

    case 'custom_amount': {
      if (!custom) {
        throw new Error('computeSplits: custom_amount split requires custom amounts.')
      }
      const me = round2(custom.meAmount)
      const partner = round2(custom.partnerAmount)
      if (!Number.isFinite(me) || me < 0 || !Number.isFinite(partner) || partner < 0) {
        throw new Error('computeSplits: custom amounts must be non-negative finite numbers.')
      }
      if (round2(me + partner) !== total) {
        throw new Error(
          `computeSplits: custom amounts (${me} + ${partner}) must sum to the total (${total}).`,
        )
      }
      return [
        { userId: meUserId, shareAmount: me },
        { userId: partnerUserId, shareAmount: partner },
      ]
    }

    default: {
      // Exhaustiveness guard — unreachable for valid SplitType.
      const _never: never = splitType
      throw new Error(`computeSplits: unknown split_type "${String(_never)}".`)
    }
  }
}
