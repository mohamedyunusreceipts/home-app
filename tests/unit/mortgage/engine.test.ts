import { describe, it, expect } from 'vitest'
import {
  amortisationSchedule,
  availableRedraw,
  bondInstalment,
  extraPaymentPayoff,
  interestSplit,
  round2,
  shadowBalance,
} from '@/lib/mortgage/engine'
import type { BondConfig, MonthlyStatement } from '@/lib/mortgage/types'

describe('bondInstalment', () => {
  it('matches the canonical R1,000,000 @ 11.25% over 240 months example (~R10,489)', () => {
    const inst = bondInstalment(1_000_000, 11.25, 240)
    // Independently computed: r = 0.1125/12 = 0.009375
    // P*r / (1 - (1+r)^-240) ≈ 10489.39
    const r = 0.1125 / 12
    const expected = (1_000_000 * r) / (1 - Math.pow(1 + r, -240))
    expect(inst).toBeCloseTo(expected, 2)
    // Canonical figure is ~R10,493 (rule-of-thumb "≈ R10,489" is approximate).
    expect(inst).toBeCloseTo(10492.56, 1)
    expect(inst).toBeGreaterThan(10_400)
    expect(inst).toBeLessThan(10_600)
  })

  it('handles the zero-rate branch (principal / termMonths)', () => {
    expect(bondInstalment(120_000, 0, 120)).toBe(1000)
  })

  it('throws on non-positive term', () => {
    expect(() => bondInstalment(100_000, 10, 0)).toThrow()
  })
})

describe('amortisationSchedule', () => {
  it('produces termMonths rows that decrease to ~0', () => {
    const term = 240
    const rows = amortisationSchedule(1_000_000, 11.25, term)
    expect(rows.length).toBeLessThanOrEqual(term)
    expect(rows.length).toBeGreaterThan(term - 2) // lands on or just before term
    const last = rows[rows.length - 1]
    expect(last).toBeDefined()
    // Instalment is rounded to 2dp, so the final balance lands within ~R1 of 0.
    expect(last!.closingBalance).toBeLessThan(1)
    expect(last!.closingBalance).toBeGreaterThanOrEqual(0)
  })

  it('sum of principalPaid ≈ original principal', () => {
    const principal = 1_000_000
    const rows = amortisationSchedule(principal, 11.25, 240)
    const totalPrincipal = rows.reduce((acc, r) => acc + r.principalPaid, 0)
    expect(totalPrincipal).toBeCloseTo(principal, 0)
  })

  it('interest + principalPaid ≈ instalment on each non-final row', () => {
    const inst = bondInstalment(1_000_000, 11.25, 240)
    const rows = amortisationSchedule(1_000_000, 11.25, 240, inst)
    for (let i = 0; i < rows.length - 1; i++) {
      const row = rows[i]
      expect(row).toBeDefined()
      expect(row!.interest + row!.principalPaid).toBeCloseTo(inst, 2)
    }
  })

  it('never emits negative balances', () => {
    const rows = amortisationSchedule(500_000, 9, 60)
    for (const row of rows) {
      expect(row.closingBalance).toBeGreaterThanOrEqual(0)
      expect(row.openingBalance).toBeGreaterThanOrEqual(0)
    }
  })

  it('handles the zero-rate case (pure principal repayment)', () => {
    const rows = amortisationSchedule(12_000, 0, 12)
    expect(rows.length).toBe(12)
    for (const row of rows) {
      expect(row.interest).toBe(0)
      expect(row.principalPaid).toBeCloseTo(1000, 2)
    }
    expect(rows[rows.length - 1]!.closingBalance).toBeCloseTo(0, 2)
  })
})

describe('shadowBalance / availableRedraw', () => {
  // Bond starting Jan 2025, 20-year term, contractual R10,000/month at 11.25%.
  const config: BondConfig = {
    originalPrincipal: 1_000_000,
    startDate: '2025-01-01',
    termMonths: 240,
    contractualInstalment: 10_000,
    currentAnnualRate: 11.25,
  }

  // User actually paid extra (so their real balance is below the shadow).
  const statements: MonthlyStatement[] = [
    {
      statementMonth: '2025-01-01',
      closingBalance: 985_000,
      interestCharged: 9375,
      annualRate: 11.25,
      totalPaid: 25_000,
    },
    {
      statementMonth: '2025-02-01',
      closingBalance: 968_000,
      interestCharged: 9234,
      annualRate: 11.25,
      totalPaid: 26_000,
    },
    {
      statementMonth: '2025-03-01',
      closingBalance: 950_000,
      interestCharged: 9075,
      annualRate: 11.25,
      totalPaid: 27_000,
    },
  ]

  it('computes shadow balance from contractual-only path', () => {
    // Month 1: 1,000,000 + 9375 - 10,000 = 999,375
    const shadow1 = shadowBalance(config, statements, '2025-01')
    expect(shadow1).toBeCloseTo(999_375, 2)

    // Month 2: 999,375 * (1+r) - 10,000
    const r = 11.25 / 100 / 12
    const expected2 = 999_375 * (1 + r) - 10_000
    const shadow2 = shadowBalance(config, statements, '2025-02')
    expect(shadow2).toBeCloseTo(round2(expected2), 2)
  })

  it('accepts YYYY-MM-01 form as asOfMonth', () => {
    const a = shadowBalance(config, statements, '2025-02')
    const b = shadowBalance(config, statements, '2025-02-01')
    expect(a).toBe(b)
  })

  it('redraw = shadow − actual closing balance, floored at 0', () => {
    const shadow = shadowBalance(config, statements, '2025-03')
    const redraw = availableRedraw(config, statements, '2025-03')
    expect(redraw).toBeCloseTo(round2(shadow - 950_000), 2)
    expect(redraw).toBeGreaterThan(0) // user paid extra → positive redraw
  })

  it('returns 0 redraw when no statement exists for that month', () => {
    expect(availableRedraw(config, statements, '2025-12')).toBe(0)
  })

  it('floors redraw at 0 when actual exceeds shadow', () => {
    const highStatements: MonthlyStatement[] = [
      {
        statementMonth: '2025-01-01',
        closingBalance: 1_500_000, // absurdly high actual
        interestCharged: 9375,
        annualRate: 11.25,
        totalPaid: 0,
      },
    ]
    expect(availableRedraw(config, highStatements, '2025-01')).toBe(0)
  })

  it('uses statement annualRate when present, else config rate', () => {
    const ratedStatements: MonthlyStatement[] = [
      {
        statementMonth: '2025-01-01',
        closingBalance: 990_000,
        interestCharged: 0,
        annualRate: 6, // lower than config 11.25
        totalPaid: 0,
      },
    ]
    const rLow = 6 / 100 / 12
    const expected = 1_000_000 + 1_000_000 * rLow - 10_000
    expect(shadowBalance(config, ratedStatements, '2025-01')).toBeCloseTo(
      round2(expected),
      2,
    )
  })

  it('floors shadow balance at 0 and never goes negative', () => {
    const smallConfig: BondConfig = {
      originalPrincipal: 5_000,
      startDate: '2025-01-01',
      termMonths: 240,
      contractualInstalment: 10_000,
      currentAnnualRate: 11.25,
    }
    expect(shadowBalance(smallConfig, [], '2025-02')).toBe(0)
  })
})

describe('extraPaymentPayoff', () => {
  it('paying extra reduces monthsToPayoff and saves interest vs baseline', () => {
    const inst = bondInstalment(1_000_000, 11.25, 240)
    const baseline = extraPaymentPayoff(1_000_000, 11.25, inst, 0)
    const accelerated = extraPaymentPayoff(1_000_000, 11.25, inst, 2_000)

    expect(baseline.monthsSaved).toBe(0)
    expect(baseline.interestSaved).toBe(0)
    expect(baseline.payoffDate).toBe('')

    expect(accelerated.monthsToPayoff).toBeLessThan(baseline.monthsToPayoff)
    expect(accelerated.monthsSaved).toBeGreaterThan(0)
    expect(accelerated.interestSaved).toBeGreaterThan(0)
    expect(accelerated.payoffDate).toBe('')
  })

  it('throws when the instalment does not cover monthly interest', () => {
    // 1,000,000 @ 11.25% → first month interest = 9375; instalment 5000 < that
    expect(() => extraPaymentPayoff(1_000_000, 11.25, 5_000, 0)).toThrow()
  })

  it('handles an already-zero balance (0 months)', () => {
    const res = extraPaymentPayoff(0, 11.25, 10_000, 0)
    expect(res.monthsToPayoff).toBe(0)
    expect(res.totalInterest).toBe(0)
  })

  it('handles the zero-rate case', () => {
    // 12,000 at 0% paying 1000/mo → 12 months baseline
    const baseline = extraPaymentPayoff(12_000, 0, 1_000, 0)
    expect(baseline.monthsToPayoff).toBe(12)
    expect(baseline.totalInterest).toBe(0)
    const faster = extraPaymentPayoff(12_000, 0, 1_000, 1_000)
    expect(faster.monthsToPayoff).toBe(6)
    expect(faster.monthsSaved).toBe(6)
  })
})

describe('interestSplit', () => {
  it('interest + principal === payment', () => {
    const split = interestSplit(900_000, 11.25, 10_000)
    expect(split.interest + split.principal).toBeCloseTo(10_000, 2)
  })

  it('interest = balance · monthly rate', () => {
    const r = 11.25 / 100 / 12
    const split = interestSplit(900_000, 11.25, 10_000)
    expect(split.interest).toBeCloseTo(round2(900_000 * r), 2)
    expect(split.principal).toBeCloseTo(10_000 - round2(900_000 * r), 2)
  })

  it('handles a zero balance (all principal)', () => {
    const split = interestSplit(0, 11.25, 10_000)
    expect(split.interest).toBe(0)
    expect(split.principal).toBe(10_000)
  })
})
