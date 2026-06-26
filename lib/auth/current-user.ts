import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Returns the currently signed-in Supabase user, or null if not signed in.
 * Reads the session from the cookies attached to the current request.
 * Server-only — do not call from client components.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}
