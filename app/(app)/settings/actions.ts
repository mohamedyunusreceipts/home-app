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

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
