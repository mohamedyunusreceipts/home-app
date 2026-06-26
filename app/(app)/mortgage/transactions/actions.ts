'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import type { MortgageRow, TransactionKind } from '@/components/mortgage/map'

export type AddTransactionResult = { error: string } | { success: true }

const VALID_KINDS: readonly TransactionKind[] = ['extra_deposit', 'withdrawal']

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function addTransactionAction(
  formData: FormData,
): Promise<AddTransactionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: mortgage } = await supabase
    .from('mortgages')
    .select('id, household_id')
    .eq('household_id', householdId)
    .maybeSingle<Pick<MortgageRow, 'id' | 'household_id'>>()

  if (!mortgage) {
    return { error: 'Set up your bond before logging contributions.' }
  }

  const kind = String(formData.get('kind') ?? '').trim()
  const amount = num(formData, 'amount')
  const occurredOn = String(formData.get('occurred_on') ?? '').trim()
  const contributorRaw = String(formData.get('contributed_by_user_id') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (!VALID_KINDS.includes(kind as TransactionKind)) {
    return { error: 'Please choose whether this is a deposit or a withdrawal.' }
  }
  if (amount == null || amount <= 0) {
    return { error: 'Please enter a valid amount greater than zero.' }
  }
  if (!occurredOn || Number.isNaN(new Date(occurredOn).getTime())) {
    return { error: 'Please choose a valid date.' }
  }

  // Resolve the contributor: empty = joint (null). A non-null contributor must
  // be an actual member of this household — validate server-side.
  let contributedByUserId: string | null = null
  if (contributorRaw !== '') {
    const { data: member } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)
      .eq('user_id', contributorRaw)
      .maybeSingle<{ user_id: string }>()

    if (!member) {
      return { error: 'The selected contributor is not a member of this household.' }
    }
    contributedByUserId = member.user_id
  }

  const { error } = await supabase.from('mortgage_transactions').insert({
    household_id: householdId,
    mortgage_id: mortgage.id,
    occurred_on: occurredOn,
    amount,
    kind: kind as TransactionKind,
    contributed_by_user_id: contributedByUserId,
    note: note || null,
  })

  if (error) return { error: error.message }

  return { success: true }
}
