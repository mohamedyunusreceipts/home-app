import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'

describe('e2e onboarding flow', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('two users complete create + invite + accept and end up co-members', async () => {
    // userA signs up and creates a household
    const userA = await createTestUser()
    const clientA = await authedClient(userA.email, userA.password)

    const { data: householdId } = await clientA.rpc('create_household', {
      p_name: 'A and B',
    })
    expect(householdId).toBeTypeOf('string')

    // userA generates an invite
    const { data: token } = await clientA.rpc('generate_invite')
    expect(token).toBeTypeOf('string')

    // userB signs up and accepts the invite
    const userB = await createTestUser()
    const clientB = await authedClient(userB.email, userB.password)

    const { data: acceptedHouseholdId, error: acceptErr } = await clientB.rpc(
      'accept_invite',
      { p_token: token! },
    )
    expect(acceptErr).toBeNull()
    expect(acceptedHouseholdId).toBe(householdId)

    // Both users can see the household via RLS
    const { data: householdsA } = await clientA.from('households').select('*')
    const { data: householdsB } = await clientB.from('households').select('*')
    expect(householdsA).toHaveLength(1)
    expect(householdsB).toHaveLength(1)
    expect(householdsA![0].id).toBe(householdId)
    expect(householdsB![0].id).toBe(householdId)

    // Both see the same 2 members
    const { data: membersA } = await clientA.from('household_members').select('*')
    const { data: membersB } = await clientB.from('household_members').select('*')
    expect(membersA).toHaveLength(2)
    expect(membersB).toHaveLength(2)

    // Both see both profiles
    const { data: profilesA } = await clientA.from('profiles').select('id')
    expect(profilesA!.map(p => p.id).sort()).toEqual([userA.id, userB.id].sort())
  })

  it('a third user creating their own household is isolated', async () => {
    // First couple
    const userA = await createTestUser()
    const clientA = await authedClient(userA.email, userA.password)
    await clientA.rpc('create_household', { p_name: 'AB' })
    const { data: tokenAB } = await clientA.rpc('generate_invite')
    const userB = await createTestUser()
    const clientB = await authedClient(userB.email, userB.password)
    await clientB.rpc('accept_invite', { p_token: tokenAB! })

    // Third user creates a separate household
    const userC = await createTestUser()
    const clientC = await authedClient(userC.email, userC.password)
    const { data: householdC } = await clientC.rpc('create_household', { p_name: 'C alone' })

    // userC cannot see household AB
    const { data: householdsC } = await clientC.from('households').select('*')
    expect(householdsC).toHaveLength(1)
    expect(householdsC![0].id).toBe(householdC)

    // userA cannot see userC's household
    const { data: householdsA } = await clientA.from('households').select('*')
    expect(householdsA!.find(h => h.id === householdC)).toBeUndefined()

    // userA cannot see userC's profile
    const { data: profilesA } = await clientA.from('profiles').select('id')
    expect(profilesA!.map(p => p.id).sort()).toEqual([userA.id, userB.id].sort())
    expect(profilesA!.find(p => p.id === userC.id)).toBeUndefined()
  })
})
