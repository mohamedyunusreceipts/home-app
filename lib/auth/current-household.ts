import { createClient } from '@/lib/supabase/server'

/**
 * Returns the household_id the current user is a member of, or null if:
 * - the user isn't signed in, or
 * - the user has no household membership yet (pre-onboarding).
 *
 * The RLS policies on household_members ensure the user only sees their own row.
 * If the query returns multiple rows (shouldn't happen — one user per household in v1),
 * returns the first.
 */
export async function getCurrentHouseholdId(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data.household_id
}
