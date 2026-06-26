// Mapping helpers: DB rows (snake_case) -> engine shapes (camelCase).
// Kept inside components/mortgage to stay within the UI workstream's scope.

import type { BondConfig, MonthlyStatement } from '@/lib/mortgage/types'

/** Shape of a `mortgages` row as returned from supabase. */
export type MortgageRow = {
  id: string
  household_id: string
  lender: string | null
  account_ref: string | null
  original_principal: number
  start_date: string
  term_months: number
  contractual_instalment: number
  current_annual_rate: number
  rate_is_prime_linked: boolean | null
  prime_delta: number | null
}

/** Shape of a `mortgage_statements` row as returned from supabase. */
export type StatementRow = {
  id: string
  household_id: string
  mortgage_id: string
  statement_month: string
  closing_balance: number
  interest_charged: number
  annual_rate: number
  total_paid: number | null
  note: string | null
}

/** Map a `mortgages` DB row into the engine's BondConfig. */
export function toBondConfig(row: MortgageRow): BondConfig {
  return {
    originalPrincipal: row.original_principal,
    startDate: row.start_date,
    termMonths: row.term_months,
    contractualInstalment: row.contractual_instalment,
    currentAnnualRate: row.current_annual_rate,
  }
}

/** Map a `mortgage_statements` DB row into the engine's MonthlyStatement. */
export function toMonthlyStatement(row: StatementRow): MonthlyStatement {
  return {
    statementMonth: row.statement_month,
    closingBalance: row.closing_balance,
    interestCharged: row.interest_charged,
    annualRate: row.annual_rate,
    totalPaid: row.total_paid,
  }
}
