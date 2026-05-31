import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, createTestUser, resetDatabase } from '@/tests/helpers/supabase'

describe('foundation tables', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('allows service role to create a household and add the owner as a member', async () => {
    const owner = await createTestUser()
    const service = serviceClient()

    const { data: household, error: hErr } = await service
      .from('households')
      .insert({ name: 'Test Home', owner_user_id: owner.id })
      .select()
      .single()

    expect(hErr).toBeNull()
    expect(household).toMatchObject({ name: 'Test Home', owner_user_id: owner.id, currency: 'ZAR' })

    const { error: mErr } = await service
      .from('household_members')
      .insert({ household_id: household!.id, user_id: owner.id, role: 'owner' })

    expect(mErr).toBeNull()
  })
})
