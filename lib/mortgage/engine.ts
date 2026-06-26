// Pure calculation engine for a South African access-bond (flexi-bond) tracker.
//
// All money is handled as plain numbers in rand and rounded to 2 decimals on
// output via round2(). Rates are supplied as a percent (e.g. 11.25) and are
// converted to a monthly fraction with: r = annualRate / 100 / 12.
//
// No I/O, no dates beyond month-string parsing — everything here is referentially
// transparent so it can be unit tested and reused by UI / API workstreams.

import type {
  BondConfig,
  InterestSplit,
  MonthlyStatement,
  PayoffResult,
  ScheduleRow,
} from './types'

/** Round a monetary value to 2 decimals, avoiding common float cruft. */
export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

/** Convert a percent annual rate to a monthly fraction. */
function monthlyRate(annualRate: number): number {
  return annualRate / 100 / 12
}

/**
 * Standard amortisation instalment: P·r / (1 − (1+r)^−n).
 * Handles the zero-rate case (returns principal / termMonths).
 * Rounded to 2 decimals.
 */
export function bondInstalment(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  if (termMonths <= 0) {
    throw new Error('termMonths must be positive')
  }
  const r = monthlyRate(annualRate)
  if (r === 0) {
    return round2(principal / termMonths)
  }
  const factor = 1 - Math.pow(1 + r, -termMonths)
  return round2((principal * r) / factor)
}

/**
 * Build a full amortisation schedule.
 * If `instalment` is omitted it is computed via bondInstalment().
 * Interest = openingBalance·r; principalPaid = instalment − interest;
 * closingBalance = openingBalance − principalPaid. The final row's
 * principalPaid may be smaller so the balance lands exactly on 0; balances
 * are never negative.
 */
export function amortisationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  instalment?: number,
): ScheduleRow[] {
  if (termMonths <= 0) {
    throw new Error('termMonths must be positive')
  }
  const r = monthlyRate(annualRate)
  const pmt = instalment ?? bondInstalment(principal, annualRate, termMonths)

  const rows: ScheduleRow[] = []
  let opening = principal

  for (let month = 1; month <= termMonths; month++) {
    if (opening <= 0) break

    const interest = round2(opening * r)
    // Cap principal so we never overpay past the outstanding balance.
    let principalPaid = round2(pmt - interest)
    if (principalPaid > opening) {
      principalPaid = opening
    }
    let closing = round2(opening - principalPaid)
    if (closing < 0) closing = 0

    rows.push({
      monthIndex: month,
      openingBalance: round2(opening),
      interest,
      principalPaid,
      closingBalance: closing,
    })

    opening = closing
  }

  return rows
}

/** Normalise 'YYYY-MM' or 'YYYY-MM-01' (or full ISO date) to a {year, month}. */
function parseMonth(month: string): { year: number; month: number } {
  const parts = month.split('-')
  const year = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(year) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error(`Invalid month string: ${month}`)
  }
  return { year, month: m }
}

/** Count whole months from `from` (inclusive baseline) up to and including `to`. */
function monthsBetweenInclusive(from: string, to: string): number {
  const a = parseMonth(from)
  const b = parseMonth(to)
  const diff = (b.year - a.year) * 12 + (b.month - a.month)
  // inclusive of the target month → number of months to iterate
  return diff + 1
}

/** Advance a {year, month} by one month. */
function nextMonth(ym: { year: number; month: number }): {
  year: number
  month: number
} {
  if (ym.month === 12) return { year: ym.year + 1, month: 1 }
  return { year: ym.year, month: ym.month + 1 }
}

/** Format a {year, month} as 'YYYY-MM-01'. */
function toStatementMonth(ym: { year: number; month: number }): string {
  const mm = String(ym.month).padStart(2, '0')
  return `${ym.year}-${mm}-01`
}

/** Build a lookup from 'YYYY-MM-01' → statement. */
function statementIndex(
  statements: MonthlyStatement[],
): Map<string, MonthlyStatement> {
  const map = new Map<string, MonthlyStatement>()
  for (const s of statements) {
    const ym = parseMonth(s.statementMonth)
    map.set(toStatementMonth(ym), s)
  }
  return map
}

/**
 * "Contractual-only" shadow balance: starting from originalPrincipal at
 * startDate, for each month up to and including asOfMonth apply
 *   bal = bal + bal·r_month − contractualInstalment   (floored at 0).
 * The monthly rate uses the matching statement's annualRate if present,
 * else config.currentAnnualRate.
 */
export function shadowBalance(
  config: BondConfig,
  statements: MonthlyStatement[],
  asOfMonth: string,
): number {
  const start = parseMonth(config.startDate)
  const months = monthsBetweenInclusive(config.startDate, asOfMonth)
  if (months <= 0) {
    return round2(config.originalPrincipal)
  }

  const byMonth = statementIndex(statements)
  let bal = config.originalPrincipal
  let cursor = start

  for (let i = 0; i < months; i++) {
    const key = toStatementMonth(cursor)
    const stmt = byMonth.get(key)
    const annualRate = stmt ? stmt.annualRate : config.currentAnnualRate
    const r = monthlyRate(annualRate)

    bal = bal + bal * r - config.contractualInstalment
    if (bal < 0) bal = 0

    cursor = nextMonth(cursor)
  }

  return round2(bal)
}

/**
 * Available redraw = shadowBalance − actualClosingBalance, floored at 0.
 * actualClosingBalance is the closingBalance of the statement for asOfMonth;
 * if no statement exists for that month, returns 0.
 */
export function availableRedraw(
  config: BondConfig,
  statements: MonthlyStatement[],
  asOfMonth: string,
): number {
  const byMonth = statementIndex(statements)
  const key = toStatementMonth(parseMonth(asOfMonth))
  const stmt = byMonth.get(key)
  if (!stmt) return 0

  const shadow = shadowBalance(config, statements, asOfMonth)
  const redraw = shadow - stmt.closingBalance
  return round2(redraw < 0 ? 0 : redraw)
}

const MAX_PAYOFF_ITERATIONS = 1200

/**
 * Simulate paying instalment + extraPerMonth each month until the balance hits
 * 0, comparing against the baseline (extra = 0).
 *
 * Date math is intentionally dropped: `payoffDate` is always '' (kept for
 * forward-compat); callers rely on `monthsToPayoff`.
 *
 * Throws if the *baseline* instalment does not cover the first month's interest
 * (a non-amortising bond would never pay off).
 */
export function extraPaymentPayoff(
  currentBalance: number,
  annualRate: number,
  instalment: number,
  extraPerMonth: number,
): PayoffResult {
  const r = monthlyRate(annualRate)

  // Guard: baseline instalment must cover the first month's interest, else the
  // balance grows without bound.
  const firstInterest = currentBalance * r
  if (currentBalance > 0 && instalment <= firstInterest) {
    throw new Error(
      `Instalment (${instalment}) does not cover monthly interest (${round2(
        firstInterest,
      )}); bond would never amortise.`,
    )
  }

  const simulate = (
    payment: number,
  ): { months: number; totalInterest: number } => {
    let bal = currentBalance
    let totalInterest = 0
    let months = 0

    while (bal > 0) {
      if (months >= MAX_PAYOFF_ITERATIONS) {
        throw new Error(
          `Payoff did not converge within ${MAX_PAYOFF_ITERATIONS} months.`,
        )
      }
      const interest = bal * r
      totalInterest += interest
      let principalPaid = payment - interest
      if (principalPaid > bal) principalPaid = bal
      bal = bal - principalPaid
      if (bal < 0) bal = 0
      months++
    }

    return { months, totalInterest: round2(totalInterest) }
  }

  const baseline = simulate(instalment)
  const accelerated = simulate(instalment + extraPerMonth)

  return {
    monthsToPayoff: accelerated.months,
    payoffDate: '',
    totalInterest: accelerated.totalInterest,
    monthsSaved: baseline.months - accelerated.months,
    interestSaved: round2(baseline.totalInterest - accelerated.totalInterest),
  }
}

/**
 * Split a single payment into interest and principal components.
 * interest = balance·r (rounded 2dp); principal = payment − interest.
 */
export function interestSplit(
  balance: number,
  annualRate: number,
  payment: number,
): InterestSplit {
  const r = monthlyRate(annualRate)
  const interest = round2(balance * r)
  const principal = round2(payment - interest)
  return { interest, principal }
}
