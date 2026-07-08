'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHousehold } from '@/lib/auth/redirects'

export async function generateInviteAction(): Promise<{ error: string } | { token: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_invite')
  if (error) return { error: error.message }
  return { token: data as string }
}

/**
 * Disconnect Google Drive for the caller's household: clears both the encrypted
 * refresh token and the cached root folder id. Owner-only (RLS plus an explicit
 * role check). Keeps things simple — does not revoke the Google grant or delete
 * any Drive files; it just forgets the connection on our side.
 */
export async function disconnectDriveAction(): Promise<{ error: string } | { ok: true }> {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .maybeSingle<{ role: string }>()
  if (membership?.role !== 'owner') {
    return { error: 'Only the household owner can disconnect Drive' }
  }

  const { error } = await supabase
    .from('households')
    .update({ drive_refresh_token_encrypted: null, drive_root_folder_id: null })
    .eq('id', householdId)
  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { ok: true }
}

/**
 * Leave the caller's household via the leave_household() RPC. Removes their
 * membership; if they were the last member the household and all its shared data
 * are deleted; if they were the owner ownership transfers to the remaining
 * member. On success they land on /setup to create or join another household.
 */
export async function leaveHouseholdAction(): Promise<{ error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('leave_household')
  if (error) return { error: error.message }
  redirect('/setup')
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
