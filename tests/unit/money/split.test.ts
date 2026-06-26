import { describe, it, expect } from 'vitest'
import { computeSplits, round2, type SplitMembers } from '@/components/money/split'

const members: SplitMembers = { meUserId: 'me', partnerUserId: 'partner' }

describe('round2', () => {
  it('rounds to two decimals without binary drift', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(100 / 3)).toBe(33.33)
  })
})

describe('computeSplits — equal', () => {
  it('halves an even amount exactly', () => {
    const shares = computeSplits(100, 'equal', members)
    expect(shares).toEqual([
      { userId: 'me', shareAmount: 50 },
      { userId: 'partner', shareAmount: 50 },
    ])
  })

  it('assigns the odd cent to me and still sums to the total', () => {
    const shares = computeSplits(100.01, 'equal', members)
    const sum = shares.reduce((s, r) => s + r.shareAmount, 0)
    expect(round2(sum)).toBe(100.01)
    // 50.01 (me) + 50.00 (partner) — note round2(100.01/2) = 50.01.
    expect(shares[0]!.shareAmount).toBe(50.01)
    expect(shares[1]!.shareAmount).toBe(50)
  })

  it('handles a zero amount', () => {
    const shares = computeSplits(0, 'equal', members)
    expect(shares).toEqual([
      { userId: 'me', shareAmount: 0 },
      { userId: 'partner', shareAmount: 0 },
    ])
  })
})

describe('computeSplits — me_only / partner_only', () => {
  it('me_only puts the whole amount on the acting user', () => {
    expect(computeSplits(250, 'me_only', members)).toEqual([
      { userId: 'me', shareAmount: 250 },
    ])
  })

  it('partner_only puts the whole amount on the partner', () => {
    expect(computeSplits(250, 'partner_only', members)).toEqual([
      { userId: 'partner', shareAmount: 250 },
    ])
  })
})

describe('computeSplits — custom_amount', () => {
  it('uses the supplied custom amounts when they reconcile', () => {
    const shares = computeSplits(100, 'custom_amount', members, {
      meAmount: 70,
      partnerAmount: 30,
    })
    expect(shares).toEqual([
      { userId: 'me', shareAmount: 70 },
      { userId: 'partner', shareAmount: 30 },
    ])
  })

  it('throws when custom amounts do not sum to the total', () => {
    expect(() =>
      computeSplits(100, 'custom_amount', members, { meAmount: 70, partnerAmount: 40 }),
    ).toThrow(/sum to the total/)
  })

  it('throws when custom amounts are missing', () => {
    expect(() => computeSplits(100, 'custom_amount', members)).toThrow(/requires custom/)
  })

  it('throws on a negative custom amount', () => {
    expect(() =>
      computeSplits(100, 'custom_amount', members, { meAmount: 120, partnerAmount: -20 }),
    ).toThrow(/non-negative/)
  })
})

describe('computeSplits — validation', () => {
  it('throws on a negative amount', () => {
    expect(() => computeSplits(-5, 'equal', members)).toThrow(/non-negative/)
  })

  it('throws on a non-finite amount', () => {
    expect(() => computeSplits(Number.NaN, 'equal', members)).toThrow(/non-negative/)
  })
})
