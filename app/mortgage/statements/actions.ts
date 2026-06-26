'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { availableRedraw, shadowBalance } from '@/lib/mortgage/engine'
import {
  toBondConfig,
  toMonthlyStatement,
  type MortgageRow,
  type StatementRow,
} from '@/components/mortgage/map'

export type AddStatementResult =
  | { error: string }
  | {
      success: true
      /** Recomputed available redraw after saving. */
      redraw: number
      /**
       * Drift between the projected closing balance (shadow schedule) for this
       * month and the actual balance entered. Positive = actual is higher than
       * projected (behind), negative = lower (ahead). Null when not computable.
       */
      drift: number | null
    }

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function addStatementAction(formData: FormData): Promise<AddStatementResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: mortgage } = await supabase
    .from('mortgages')
    .select(
      'id, household_id, lender, account_ref, original_principal, start_date, term_months, contractual_instalment, current_annual_rate, rate_is_prime_linked, prime_delta',
    )
    .eq('household_id', householdId)
    .maybeSingle<MortgageRow>()

  if (!mortgage) {
    return { error: 'Set up your bond before adding statements.' }
  }

  const statementMonth = String(formData.get('statement_month') ?? '').trim()
  const closingBalance = num(formData, 'closing_balance')
  const interestCharged = num(formData, 'interest_charged')
  const annualRate = num(formData, 'annual_rate')
  const totalPaid = num(formData, 'total_paid')
  const note = String(formData.get('note') ?? '').trim()

  if (!statementMonth) return { error: 'Please choose a statement month.' }
  if (closingBalance == null || closingBalance < 0)
    return { error: 'Please enter a valid closing balance.' }
  if (interestCharged == null || interestCharged < 0)
    return { error: 'Please enter a valid interest-charged amount.' }
  if (annualRate == null || annualRate <= 0)
    return { error: 'Please enter a valid annual rate.' }

  // Normalise the month to the first of the month for a stable unique key.
  const normalisedMonth = `${statementMonth.slice(0, 7)}-01`

  // Compute the drift note BEFORE inserting this row, using the existing history
  // as the basis for the shadow projection of this month's balance.
  const { data: priorRows } = await supabase
    .from('mortgage_statements')
    .select(
      'id, household_id, mortgage_id, statement_month, closing_balance, interest_charged, annual_rate, total_paid, note',
    )
    .eq('mortgage_id', mortgage.id)
    .order('statement_month', { ascending: true })
    .returns<StatementRow[]>()

  const config = toBondConfig(mortgage)
  let drift: number | null = null
  try {
    const priorStatements = (priorRows ?? [])
      .filter((r) => r.statement_month.slice(0, 7) !== normalisedMonth.slice(0, 7))
      .map(toMonthlyStatement)
    const projected = shadowBalance(config, priorStatements, normalisedMonth)
    if (Number.isFinite(projected)) {
      drift = closingBalance - projected
    }
  } catch {
    drift = null
  }

  const payload = {
    household_id: householdId,
    mortgage_id: mortgage.id,
    statement_month: normalisedMonth,
    closing_balance: closingBalance,
    interest_charged: interestCharged,
    annual_rate: annualRate,
    total_paid: totalPaid,
    note: note || null,
  }

  // Upsert by (mortgage_id, statement_month).
  const { error } = await supabase
    .from('mortgage_statements')
    .upsert(payload, { onConflict: 'mortgage_id,statement_month' })

  if (error) return { error: error.message }

  // Recompute redraw including the just-saved statement.
  const { data: freshRows } = await supabase
    .from('mortgage_statements')
    .select(
      'id, household_id, mortgage_id, statement_month, closing_balance, interest_charged, annual_rate, total_paid, note',
    )
    .eq('mortgage_id', mortgage.id)
    .order('statement_month', { ascending: true })
    .returns<StatementRow[]>()

  const statements = (freshRows ?? []).map(toMonthlyStatement)
  let redraw = 0
  try {
    redraw = availableRedraw(config, statements, normalisedMonth)
  } catch {
    redraw = 0
  }

  return { success: true, redraw, drift }
}
