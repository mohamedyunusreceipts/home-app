'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { buildRrule, isValidRrule, type RecurrenceFreq } from '@/lib/rrule'

export type SaveResult = { error: string } | { success: true }

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const FREQS: readonly RecurrenceFreq[] = ['daily', 'weekly', 'monthly', 'yearly']

/** Build an RRULE string from the simple freq+interval form fields (or null). */
function rruleFromForm(formData: FormData): string | null {
  const freq = String(formData.get('freq') ?? '').trim()
  if (!FREQS.includes(freq as RecurrenceFreq)) return null
  const interval = num(formData, 'interval') ?? 1
  try {
    const rule = buildRrule({ freq: freq as RecurrenceFreq, interval: Math.max(1, Math.round(interval)) })
    return isValidRrule(rule) ? rule : null
  } catch {
    return null
  }
}

export async function saveBillAction(formData: FormData): Promise<SaveResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = String(formData.get('name') ?? '').trim()
  const amount = num(formData, 'amount')
  const nextDue = String(formData.get('next_due') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()
  const autoPay = formData.get('auto_pay') === 'on'

  if (!name) return { error: 'Please enter a name.' }
  if (amount == null || amount < 0) return { error: 'Please enter a valid amount.' }

  const { error } = await supabase.from('bills').insert({
    household_id: householdId,
    name,
    amount,
    recurrence_rrule: rruleFromForm(formData),
    next_due: nextDue || null,
    category: category || null,
    auto_pay: autoPay,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function saveSubscriptionAction(formData: FormData): Promise<SaveResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = String(formData.get('name') ?? '').trim()
  const amount = num(formData, 'amount')
  const nextCharge = String(formData.get('next_charge') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()
  const cancelUrl = String(formData.get('cancel_url') ?? '').trim()

  if (!name) return { error: 'Please enter a name.' }
  if (amount == null || amount < 0) return { error: 'Please enter a valid amount.' }

  const { error } = await supabase.from('subscriptions').insert({
    household_id: householdId,
    name,
    amount,
    recurrence_rrule: rruleFromForm(formData),
    next_charge: nextCharge || null,
    category: category || null,
    cancel_url: cancelUrl || null,
  })

  if (error) return { error: error.message }
  return { success: true }
}
