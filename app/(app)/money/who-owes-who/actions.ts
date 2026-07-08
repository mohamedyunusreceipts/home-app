'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { sendPushToUser } from '@/lib/notifications/push'
import { buildRrule } from '@/lib/rrule'
import { computeOutstanding, type SettlementRow } from '@/components/money/settlement'
import { round2 } from '@/components/money/split'
import { resolveMembers, displayName } from '@/components/money/members'
import { formatZar } from '@/components/money/format'
import type {
  ExpenseRow,
  ExpenseSplitRow,
  SettlementRow as SettlementDbRow,
} from '@/components/money/map'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SettlementActionResult = { error: string } | { success: true }

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Load the split rows + settlements needed to compute the current outstanding. */
async function loadBalanceInputs(supabase: SupabaseClient, householdId: string) {
  const [{ data: expenseRows }, { data: splitRows }, { data: settlementRows }, members] =
    await Promise.all([
      supabase
        .from('expenses')
        .select('id, paid_by_user_id, amount')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .returns<Pick<ExpenseRow, 'id' | 'paid_by_user_id' | 'amount'>[]>(),
      supabase
        .from('expense_splits')
        .select('expense_id, user_id, share_amount')
        .eq('household_id', householdId)
        .returns<Pick<ExpenseSplitRow, 'expense_id' | 'user_id' | 'share_amount'>[]>(),
      supabase
        .from('settlements')
        .select('from_user_id, to_user_id, amount')
        .eq('household_id', householdId)
        .returns<Pick<SettlementDbRow, 'from_user_id' | 'to_user_id' | 'amount'>[]>(),
      resolveMembers(supabase, householdId),
    ])

  const expenses = (expenseRows ?? []).map((e) => ({
    id: e.id,
    paidByUserId: e.paid_by_user_id,
    amount: e.amount,
  }))
  const splits = (splitRows ?? []).map((s) => ({
    expenseId: s.expense_id,
    userId: s.user_id,
    shareAmount: s.share_amount,
  }))
  const settlements: SettlementRow[] = (settlementRows ?? []).map((s) => ({
    fromUserId: s.from_user_id,
    toUserId: s.to_user_id,
    amount: s.amount,
  }))

  return { expenses, splits, settlements, members }
}

/**
 * Record a repayment against the running balance. The payer (from) is whoever
 * currently owes; the recipient (to) is the other member. After inserting we
 * notify the person owed with the remaining balance, and if the debt is now
 * cleared we also send an "All square" notification.
 */
export async function recordSettlementAction(
  formData: FormData,
): Promise<SettlementActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const amount = num(formData, 'amount')
  const occurredOn = String(formData.get('occurred_on') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (amount == null || amount <= 0) return { error: 'Please enter a repayment amount greater than zero.' }
  if (!occurredOn) return { error: 'Please choose a date.' }

  const { expenses, splits, settlements, members } = await loadBalanceInputs(supabase, householdId)
  const memberIds = members.map((m) => m.userId)
  const balance = computeOutstanding(expenses, splits, settlements, memberIds)

  if (balance.owerId == null || balance.owedId == null || balance.outstanding <= 0) {
    return { error: "You're all square — there's nothing to repay." }
  }

  const fromUserId = balance.owerId
  const toUserId = balance.owedId

  const { error: insertError } = await supabase.from('settlements').insert({
    household_id: householdId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    amount,
    note: note || null,
    occurred_on: occurredOn,
  })
  if (insertError) return { error: insertError.message }

  // Remaining after this repayment (floored at 0 for messaging purposes).
  const remaining = Math.max(0, round2(balance.outstanding - amount))
  const payerName = displayName(fromUserId, members) // don't personalise as "You" for the recipient

  // Notify the person owed. Failures here must not fail the recorded repayment.
  try {
    if (remaining <= 0) {
      await createNotification(supabase, {
        householdId,
        userId: toUserId,
        kind: 'settlement',
        title: 'All square ✓',
        body: `${payerName} paid you ${formatZar(amount)} — you're all settled up.`,
        link: '/money/who-owes-who',
      })
      await sendPushToUser(supabase, toUserId, {
        title: 'All square ✓',
        body: `${payerName} paid you ${formatZar(amount)} — you're all settled up.`,
        link: '/money/who-owes-who',
        tag: 'settlement-square',
      })
    } else {
      const body = `${payerName} paid you ${formatZar(amount)} — ${formatZar(remaining)} left.`
      await createNotification(supabase, {
        householdId,
        userId: toUserId,
        kind: 'settlement',
        title: 'Repayment received',
        body,
        link: '/money/who-owes-who',
      })
      await sendPushToUser(supabase, toUserId, {
        title: 'Repayment received',
        body,
        link: '/money/who-owes-who',
        tag: 'settlement-repayment',
      })
    }
  } catch (notifyErr) {
    console.error('[settlements] notify failed:', notifyErr)
  }

  return { success: true }
}

/**
 * Create or update the ower's installment plan. Amount + frequency build an
 * RRULE; the supplied start date becomes next_due. Any existing active plan in
 * the same direction is deactivated first (one active plan per direction).
 */
export async function savePaymentPlanAction(
  formData: FormData,
): Promise<SettlementActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const installment = num(formData, 'installment_amount')
  const frequency = String(formData.get('frequency') ?? '').trim() // 'weekly' | 'monthly'
  const startDate = String(formData.get('next_due') ?? '').trim()

  if (installment == null || installment <= 0) {
    return { error: 'Please enter an installment amount greater than zero.' }
  }
  if (frequency !== 'weekly' && frequency !== 'monthly') {
    return { error: 'Please choose a frequency.' }
  }
  if (!startDate) return { error: 'Please choose a start date.' }

  const { expenses, splits, settlements, members } = await loadBalanceInputs(supabase, householdId)
  const memberIds = members.map((m) => m.userId)
  const balance = computeOutstanding(expenses, splits, settlements, memberIds)

  if (balance.owerId == null || balance.owedId == null || balance.outstanding <= 0) {
    return { error: "You're all square — no payment plan is needed." }
  }

  let rrule: string
  try {
    rrule = buildRrule({ freq: frequency })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not build the schedule.' }
  }

  // Deactivate any existing active plan in this direction, then insert the new one.
  const { error: deactivateError } = await supabase
    .from('settlement_plans')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .eq('from_user_id', balance.owerId)
    .eq('active', true)
  if (deactivateError) return { error: deactivateError.message }

  const { error: insertError } = await supabase.from('settlement_plans').insert({
    household_id: householdId,
    from_user_id: balance.owerId,
    to_user_id: balance.owedId,
    installment_amount: installment,
    recurrence_rrule: rrule,
    next_due: startDate,
    active: true,
  })
  if (insertError) return { error: insertError.message }

  return { success: true }
}

/** Deactivate a payment plan (set active = false). */
export async function cancelPaymentPlanAction(
  formData: FormData,
): Promise<SettlementActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const planId = String(formData.get('plan_id') ?? '').trim()
  if (!planId) return { error: 'Missing plan id.' }

  const { error } = await supabase
    .from('settlement_plans')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('household_id', householdId)
  if (error) return { error: error.message }

  return { success: true }
}
