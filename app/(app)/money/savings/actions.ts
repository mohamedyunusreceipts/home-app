'use server'

import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type SaveResult = { error: string } | { success: true }

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function createGoalAction(formData: FormData): Promise<SaveResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = String(formData.get('name') ?? '').trim()
  const target = num(formData, 'target')
  const current = num(formData, 'current') ?? 0
  const deadline = String(formData.get('deadline') ?? '').trim()

  if (!name) return { error: 'Please name your goal.' }
  if (target == null || target <= 0) return { error: 'Please enter a valid target.' }
  if (current < 0) return { error: 'Saved-so-far cannot be negative.' }

  const { error } = await supabase.from('savings_goals').insert({
    household_id: householdId,
    name,
    target,
    current,
    deadline: deadline || null,
  })

  if (error) return { error: error.message }
  return { success: true }
}

/** Add to (or subtract from) a goal's running balance. */
export async function adjustGoalAction(formData: FormData): Promise<SaveResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const goalId = String(formData.get('goal_id') ?? '').trim()
  const delta = num(formData, 'delta')
  if (!goalId) return { error: 'Missing goal.' }
  if (delta == null) return { error: 'Please enter an amount.' }

  // Read the current value (RLS scopes this to the household), then clamp ≥ 0.
  const { data: goal } = await supabase
    .from('savings_goals')
    .select('id, current')
    .eq('id', goalId)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; current: number }>()

  if (!goal) return { error: 'Goal not found.' }

  const next = Math.max(0, goal.current + delta)
  const { error } = await supabase
    .from('savings_goals')
    .update({ current: next })
    .eq('id', goalId)
    .eq('household_id', householdId)

  if (error) return { error: error.message }
  return { success: true }
}
