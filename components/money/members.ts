// Server helper: resolve a household's members to display-name options, plus a
// pure name-lookup. Used by Money pages that show payer / who-owes-who names.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MemberOption } from './map'

type MemberProfileRow = {
  user_id: string
  profiles: { id: string; display_name: string | null; email: string } | null
}

/**
 * Fetch the household's members with a best-effort display name (display_name →
 * email → "Partner"). RLS scopes this to the caller's household.
 */
export async function resolveMembers(
  supabase: SupabaseClient,
  householdId: string,
): Promise<MemberOption[]> {
  const { data } = await supabase
    .from('household_members')
    .select('user_id, profiles ( id, display_name, email )')
    .eq('household_id', householdId)
    .returns<MemberProfileRow[]>()

  return (data ?? []).map((m) => ({
    userId: m.user_id,
    name: m.profiles?.display_name || m.profiles?.email || 'Partner',
  }))
}

/** Resolve a user id to a display name; the signed-in user reads as "You". */
export function displayName(
  userId: string,
  members: readonly MemberOption[],
  currentUserId?: string,
): string {
  if (currentUserId && userId === currentUserId) return 'You'
  return members.find((m) => m.userId === userId)?.name ?? 'Partner'
}
