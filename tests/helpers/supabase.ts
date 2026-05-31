import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function createTestUser(
  email?: string,
): Promise<{ id: string; email: string; password: string }> {
  const service = serviceClient()
  const generatedEmail = email ?? `user-${randomUUID()}@test.local`
  const password = `Test-${randomUUID()}`
  const { data, error } = await service.auth.admin.createUser({
    email: generatedEmail,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message}`)
  }
  return { id: data.user.id, email: generatedEmail, password }
}

export async function authedClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed: ${error.message}`)
  return client
}

export async function resetDatabase(): Promise<void> {
  const service = serviceClient()
  // Order matters: invites → household_members → households → auth.users
  await service.from('invites').delete().neq('token', '__never__')
  await service.from('household_members').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  await service.from('households').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { data: users } = await service.auth.admin.listUsers()
  for (const user of users?.users ?? []) {
    await service.auth.admin.deleteUser(user.id)
  }
}
