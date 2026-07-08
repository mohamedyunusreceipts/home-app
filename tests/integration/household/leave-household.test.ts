import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTestUser,
  authedClient,
  serviceClient,
  resetDatabase,
} from '@/tests/helpers/supabase'

describe('leave_household RPC', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  // Owner creates a household and a partner accepts an invite into it, giving a
  // populated 2-person household to exercise the leave paths against.
  async function setupCouple() {
    const owner = await createTestUser()
    const ownerClient = await authedClient(owner.email, owner.password)
    const { data: householdId, error: createErr } = await ownerClient.rpc('create_household', {
      p_name: 'Test Home',
    })
    expect(createErr).toBeNull()

    const { data: token } = await ownerClient.rpc('generate_invite')

    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)
    const { error: acceptErr } = await partnerClient.rpc('accept_invite', { p_token: token! })
    expect(acceptErr).toBeNull()

    return {
      owner,
      ownerClient,
      partner,
      partnerClient,
      householdId: householdId as string,
    }
  }

  it('partner leaving a 2-person household removes only their membership; owner and household remain unchanged', async () => {
    const { owner, partner, partnerClient, householdId } = await setupCouple()

    const { error } = await partnerClient.rpc('leave_household')
    expect(error).toBeNull()

    const service = serviceClient()

    // Partner has no membership anywhere.
    const { data: partnerMemberships } = await service
      .from('household_members')
      .select('*')
      .eq('user_id', partner.id)
    expect(partnerMemberships).toHaveLength(0)

    // Household still exists with the owner as its sole member.
    const { data: household } = await service
      .from('households')
      .select('id, owner_user_id')
      .eq('id', householdId)
      .maybeSingle()
    expect(household).not.toBeNull()
    expect(household!.owner_user_id).toBe(owner.id)

    const { data: members } = await service
      .from('household_members')
      .select('user_id, role')
      .eq('household_id', householdId)
    expect(members).toHaveLength(1)
    expect(members![0]).toMatchObject({ user_id: owner.id, role: 'owner' })
  })

  it('owner leaving a 2-person household transfers ownership to the remaining member', async () => {
    const { owner, partner, ownerClient, householdId } = await setupCouple()

    const { error } = await ownerClient.rpc('leave_household')
    expect(error).toBeNull()

    const service = serviceClient()

    // Household still exists, now owned by the former partner.
    const { data: household } = await service
      .from('households')
      .select('id, owner_user_id')
      .eq('id', householdId)
      .maybeSingle()
    expect(household).not.toBeNull()
    expect(household!.owner_user_id).toBe(partner.id)

    // Former owner has no membership; partner is now the owner-role member.
    const { data: members } = await service
      .from('household_members')
      .select('user_id, role')
      .eq('household_id', householdId)
    expect(members).toHaveLength(1)
    expect(members![0]).toMatchObject({ user_id: partner.id, role: 'owner' })

    const { data: ownerMemberships } = await service
      .from('household_members')
      .select('*')
      .eq('user_id', owner.id)
    expect(ownerMemberships).toHaveLength(0)
  })

  it('sole member leaving deletes the household', async () => {
    const solo = await createTestUser()
    const soloClient = await authedClient(solo.email, solo.password)
    const { data: householdId } = await soloClient.rpc('create_household', {
      p_name: 'Solo Home',
    })

    const { error } = await soloClient.rpc('leave_household')
    expect(error).toBeNull()

    const service = serviceClient()

    const { data: household } = await service
      .from('households')
      .select('id')
      .eq('id', householdId as string)
      .maybeSingle()
    expect(household).toBeNull()

    const { data: members } = await service
      .from('household_members')
      .select('*')
      .eq('household_id', householdId as string)
    expect(members).toHaveLength(0)
  })

  it('is a no-op when the caller has no household', async () => {
    const loner = await createTestUser()
    const lonerClient = await authedClient(loner.email, loner.password)

    const { error } = await lonerClient.rpc('leave_household')
    expect(error).toBeNull()

    const service = serviceClient()
    const { data: members } = await service
      .from('household_members')
      .select('*')
      .eq('user_id', loner.id)
    expect(members).toHaveLength(0)
  })
})
