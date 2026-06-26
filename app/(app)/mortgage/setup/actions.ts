'use server'

import { redirect } from 'next/navigation'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type SetupBondResult = { error: string } | { success: true }

/** Parse a required positive number from FormData. */
function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function upsertBondAction(formData: FormData): Promise<SetupBondResult> {
  const { householdId } = await requireHousehold()

  const lender = String(formData.get('lender') ?? '').trim()
  const accountRef = String(formData.get('account_ref') ?? '').trim()
  const startDate = String(formData.get('start_date') ?? '').trim()
  const originalPrincipal = num(formData, 'original_principal')
  const termMonths = num(formData, 'term_months')
  const contractualInstalment = num(formData, 'contractual_instalment')
  const currentAnnualRate = num(formData, 'current_annual_rate')
  const rateIsPrimeLinked = formData.get('rate_is_prime_linked') === 'on'
  const primeDelta = num(formData, 'prime_delta')

  if (!lender) return { error: 'Please enter your lender.' }
  if (!startDate) return { error: 'Please enter the bond start date.' }
  if (originalPrincipal == null || originalPrincipal <= 0)
    return { error: 'Please enter a valid original principal.' }
  if (termMonths == null || termMonths <= 0)
    return { error: 'Please enter a valid term in months.' }
  if (contractualInstalment == null || contractualInstalment <= 0)
    return { error: 'Please enter a valid contractual instalment.' }
  if (currentAnnualRate == null || currentAnnualRate <= 0)
    return { error: 'Please enter a valid annual interest rate.' }

  const supabase = await createClient()

  // One mortgage per household. Look up any existing row so we update in place.
  const { data: existing } = await supabase
    .from('mortgages')
    .select('id')
    .eq('household_id', householdId)
    .maybeSingle<{ id: string }>()

  const payload = {
    household_id: householdId,
    lender,
    account_ref: accountRef || null,
    original_principal: originalPrincipal,
    start_date: startDate,
    term_months: Math.round(termMonths),
    contractual_instalment: contractualInstalment,
    current_annual_rate: currentAnnualRate,
    rate_is_prime_linked: rateIsPrimeLinked,
    prime_delta: rateIsPrimeLinked ? primeDelta : null,
  }

  if (existing) {
    const { error } = await supabase
      .from('mortgages')
      .update(payload)
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('mortgages').insert(payload)
    if (error) return { error: error.message }
  }

  redirect('/mortgage')
}
