import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type HomeMember = { id: string; label: string }

/**
 * Fetch the household members (up to two — couples) for assignee dropdowns and
 * last-done attribution. RLS scopes household_members + profiles to the caller's
 * household, so no explicit household filter is required. Returns both a list
 * (for selects) and an id→name lookup (for display).
 */
export async function fetchHouseholdMembers(): Promise<{
  members: HomeMember[]
  names: Record<string, string>
}> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('household_members')
    .select('user_id, profiles ( display_name, email )')
    .returns<
      { user_id: string; profiles: { display_name: string | null; email: string } | null }[]
    >()

  const members: HomeMember[] = []
  const names: Record<string, string> = {}
  for (const row of data ?? []) {
    const label = row.profiles?.display_name || row.profiles?.email || 'Member'
    members.push({ id: row.user_id, label })
    names[row.user_id] = label
  }
  return { members, names }
}
