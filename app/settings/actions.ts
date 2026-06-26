'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function generateInviteAction(): Promise<{ error: string } | { token: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_invite')
  if (error) return { error: error.message }
  return { token: data as string }
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
