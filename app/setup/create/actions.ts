'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type CreateHouseholdResult = { error: string } | { success: true }

export async function createHouseholdAction(formData: FormData): Promise<CreateHouseholdResult> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: 'Please enter a household name.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_household', { p_name: name })

  if (error) {
    if (error.message.match(/already a member/i)) {
      // Edge case — race or stale UI. Bounce to dashboard.
      redirect('/dashboard')
    }
    return { error: error.message }
  }

  redirect('/dashboard')
}
