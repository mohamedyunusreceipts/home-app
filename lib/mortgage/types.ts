// Pure type contract for the access-bond (flexi-bond) calculation engine.
// Other workstreams depend on these names verbatim — do not rename.

export type BondConfig = {
  originalPrincipal: number // rand
  startDate: string // ISO 'YYYY-MM-DD'
  termMonths: number
  contractualInstalment: number // rand/month
  currentAnnualRate: number // percent, e.g. 11.25
}

export type MonthlyStatement = {
  statementMonth: string // 'YYYY-MM-01'
  closingBalance: number
  interestCharged: number
  annualRate: number // percent
  totalPaid?: number | null
}

export type ScheduleRow = {
  monthIndex: number // 1-based
  openingBalance: number
  interest: number
  principalPaid: number
  closingBalance: number
}

export type PayoffResult = {
  monthsToPayoff: number
  payoffDate: string // 'YYYY-MM'
  totalInterest: number
  monthsSaved: number
  interestSaved: number
}

export type InterestSplit = { interest: number; principal: number }
