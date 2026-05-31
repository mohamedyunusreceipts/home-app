import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'

describe('profiles_self_select', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('a user with no household memberships can still read their own profile', async () => {
    const user = await createTestUser('self-select@test.local')
    const client = await authedClient(user.email, user.password)

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({ id: user.id, email: 'self-select@test.local' })
  })
})
