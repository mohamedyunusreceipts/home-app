'use server'

import { revalidatePath } from 'next/cache'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { nextOccurrence } from '@/lib/rrule'

export type MarkBillPaidResult =
  | { error: string }
  | { success: true; nextDue: string | null }

/**
 * Mark a bill or subscription as paid from the Today timeline.
 *
 * Mirrors the chore tick-off pattern (components/home/map → computeTickOff):
 * loads the row's recurrence, and when it carries an RRULE advances the due
 * column (`next_due` for bills, `next_charge` for subscriptions) to the next
 * occurrence strictly after now via lib/rrule `nextOccurrence`. A one-off bill
 * (no rrule) has its due date cleared, so it drops out of "due today".
 *
 * RLS already scopes rows to the caller's household; we also filter by
 * household_id for safety. Never throws on a bad rule — an unparseable RRULE
 * just clears the due date rather than blocking the action.
 */
export async function markBillPaidAction(
  kind: 'bill' | 'subscription',
  id: string,
): Promise<MarkBillPaidResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const table = kind === 'bill' ? 'bills' : 'subscriptions'
  const dueColumn = kind === 'bill' ? 'next_due' : 'next_charge'

  const { data: row, error: loadError } = await supabase
    .from(table)
    .select(`id, recurrence_rrule`)
    .eq('id', id)
    .eq('household_id', householdId)
    .maybeSingle<{ id: string; recurrence_rrule: string | null }>()

  if (loadError) return { error: loadError.message }
  if (!row) return { error: 'That bill no longer exists.' }

  let nextDue: string | null = null
  if (row.recurrence_rrule && row.recurrence_rrule.trim() !== '') {
    try {
      const next = nextOccurrence(row.recurrence_rrule, new Date())
      // The due columns are date-only; lib/rrule returns occurrence components
      // as UTC wall-clock, so the UTC calendar date is the next due date.
      if (next) nextDue = next.toISOString().slice(0, 10)
    } catch {
      nextDue = null
    }
  }

  const { error } = await supabase
    .from(table)
    .update({ [dueColumn]: nextDue })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true, nextDue }
}
