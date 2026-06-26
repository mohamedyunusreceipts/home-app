'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function acceptInviteAction(formData: FormData): Promise<{ error: string }> {
  const token = String(formData.get('token') ?? '')
  if (!token) return { error: 'Missing invite token.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_invite', { p_token: token })

  if (error) return { error: error.message }

  redirect('/dashboard')
}
