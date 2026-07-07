'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { computeSplits, type SplitType, type CustomAmounts } from '@/components/money/split'

export type AddExpenseResult = { error: string } | { success: true }

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const SPLIT_TYPES: readonly SplitType[] = ['equal', 'me_only', 'partner_only', 'custom_amount']

/**
 * Insert an expense and its computed splits. The split rows are derived from the
 * pure computeSplits() helper, then inserted with the same household_id so RLS
 * is consistent. Best-effort cleanup of the expense if splits fail to insert.
 */
export async function addExpenseAction(formData: FormData): Promise<AddExpenseResult> {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const date = String(formData.get('date') ?? '').trim()
  const amount = num(formData, 'amount')
  const category = String(formData.get('category') ?? '').trim()
  const paidBy = String(formData.get('paid_by_user_id') ?? '').trim()
  const splitTypeRaw = String(formData.get('split_type') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const receiptDriveFileId = String(formData.get('receipt_drive_file_id') ?? '').trim()
  const partnerUserId = String(formData.get('partner_user_id') ?? '').trim()

  if (!date) return { error: 'Please choose a date.' }
  if (amount == null || amount < 0) return { error: 'Please enter a valid amount.' }
  if (!category) return { error: 'Please choose a category.' }
  if (!paidBy) return { error: 'Please choose who paid.' }
  if (!SPLIT_TYPES.includes(splitTypeRaw as SplitType)) {
    return { error: 'Please choose how to split this expense.' }
  }
  const splitType = splitTypeRaw as SplitType

  // The "me" side of the split is the paying user; the partner is the other member.
  // partner_user_id is supplied by the form (it knows the household's two members).
  if (splitType !== 'me_only' && !partnerUserId) {
    return {
      error: 'Splitting needs a second person — invite your partner from Settings, then try again.',
    }
  }

  let custom: CustomAmounts | undefined
  if (splitType === 'custom_amount') {
    const meAmount = num(formData, 'custom_me')
    const partnerAmount = num(formData, 'custom_partner')
    if (meAmount == null || partnerAmount == null) {
      return { error: 'Enter both custom amounts.' }
    }
    custom = { meAmount, partnerAmount }
  }

  let shares
  try {
    shares = computeSplits(
      amount,
      splitType,
      { meUserId: paidBy, partnerUserId: partnerUserId || user.id },
      custom,
    )
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not compute the split.' }
  }

  const { data: inserted, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      household_id: householdId,
      date,
      amount,
      category,
      paid_by_user_id: paidBy,
      split_type: splitType,
      description: description || null,
      receipt_drive_file_id: receiptDriveFileId || null,
    })
    .select('id')
    .single<{ id: string }>()

  if (expenseError || !inserted) {
    return { error: expenseError?.message ?? 'Could not save the expense.' }
  }

  const splitPayload = shares.map((s) => ({
    household_id: householdId,
    expense_id: inserted.id,
    user_id: s.userId,
    share_amount: s.shareAmount,
  }))

  const { error: splitError } = await supabase.from('expense_splits').insert(splitPayload)
  if (splitError) {
    // Roll back the orphaned expense so the data stays consistent.
    await supabase.from('expenses').delete().eq('id', inserted.id)
    return { error: splitError.message }
  }

  return { success: true }
}
