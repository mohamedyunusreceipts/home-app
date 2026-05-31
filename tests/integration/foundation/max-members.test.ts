import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, createTestUser, resetDatabase } from '@/tests/helpers/supabase'

describe('max-2-members trigger', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('rejects a third member with a clear error', async () => {
    const u1 = await createTestUser()
    const u2 = await createTestUser()
    const u3 = await createTestUser()
    const service = serviceClient()

    const { data: household } = await service
      .from('households')
      .insert({ name: 'Test', owner_user_id: u1.id })
      .select()
      .single()

    const householdId = household!.id

    const { error: e1 } = await service
      .from('household_members')
      .insert({ household_id: householdId, user_id: u1.id, role: 'owner' })
    expect(e1).toBeNull()

    const { error: e2 } = await service
      .from('household_members')
      .insert({ household_id: householdId, user_id: u2.id, role: 'partner' })
    expect(e2).toBeNull()

    const { error: e3 } = await service
      .from('household_members')
      .insert({ household_id: householdId, user_id: u3.id, role: 'partner' })

    expect(e3).not.toBeNull()
    expect(e3!.message).toMatch(/max 2/i)
  })
})
