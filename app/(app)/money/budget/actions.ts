'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type SaveBudgetResult = { error: string } | { success: true }

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Upsert a per-category budget limit for a given month. month comes in as
 * 'YYYY-MM' and is normalised to the 1st for the (household, month, category)
 * unique key.
 */
export async function saveBudgetAction(formData: FormData): Promise<SaveBudgetResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const monthRaw = String(formData.get('month') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()
  const limitAmount = num(formData, 'limit_amount')

  if (!/^\d{4}-\d{2}$/.test(monthRaw)) return { error: 'Please choose a valid month.' }
  if (!category) return { error: 'Please choose a category.' }
  if (limitAmount == null || limitAmount < 0) return { error: 'Please enter a valid limit.' }

  const month = `${monthRaw}-01`

  const { error } = await supabase.from('budgets').upsert(
    {
      household_id: householdId,
      month,
      category,
      limit_amount: limitAmount,
    },
    { onConflict: 'household_id,month,category' },
  )

  if (error) return { error: error.message }
  return { success: true }
}
