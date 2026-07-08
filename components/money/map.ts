// Row shapes for the Money module DB tables (snake_case as returned by supabase).
// Kept inside components/money to stay within this module's scope (no shared lib
// changes), mirroring components/mortgage/map.ts.

import type { SplitType } from './split'

export type ExpenseRow = {
  id: string
  household_id: string
  date: string
  amount: number
  category: string
  paid_by_user_id: string
  split_type: SplitType
  description: string | null
  receipt_drive_file_id: string | null
  created_at: string
}

export type ExpenseSplitRow = {
  id: string
  household_id: string
  expense_id: string
  user_id: string
  share_amount: number
}

export type BillRow = {
  id: string
  household_id: string
  name: string
  amount: number
  recurrence_rrule: string | null
  next_due: string | null
  category: string | null
  auto_pay: boolean
}

export type SubscriptionRow = {
  id: string
  household_id: string
  name: string
  amount: number
  recurrence_rrule: string | null
  next_charge: string | null
  category: string | null
  cancel_url: string | null
}

export type BudgetRow = {
  id: string
  household_id: string
  month: string
  category: string
  limit_amount: number
}

export type SavingsGoalRow = {
  id: string
  household_id: string
  name: string
  target: number
  current: number
  deadline: string | null
  drive_image_id: string | null
}

export type SettlementRow = {
  id: string
  household_id: string
  from_user_id: string
  to_user_id: string
  amount: number
  note: string | null
  occurred_on: string
  created_at: string
}

export type SettlementPlanRow = {
  id: string
  household_id: string
  from_user_id: string
  to_user_id: string
  installment_amount: number
  recurrence_rrule: string
  next_due: string
  last_reminded_on: string | null
  active: boolean
  created_at: string
  updated_at: string
}

/** A household member with a resolved display name (for payer/split UIs). */
export type MemberOption = {
  userId: string
  name: string
}
