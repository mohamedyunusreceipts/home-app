import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, createTestUser, resetDatabase } from '@/tests/helpers/supabase'

describe('profile auto-create trigger', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('inserts a profiles row when a user is created in auth.users', async () => {
    const user = await createTestUser('trigger-test@test.local')
    const service = serviceClient()

    const { data, error } = await service
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({ id: user.id, email: 'trigger-test@test.local' })
  })
})
