import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, serviceClient, resetDatabase } from '@/tests/helpers/supabase'

describe('invite RPCs', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function setupOwnerWithHousehold() {
    const owner = await createTestUser()
    const ownerClient = await authedClient(owner.email, owner.password)
    const { data: householdId, error } = await ownerClient.rpc('create_household', {
      p_name: 'Test Home',
    })
    expect(error).toBeNull()
    return { owner, ownerClient, householdId: householdId as string }
  }

  it('owner can generate an invite token', async () => {
    const { ownerClient, householdId } = await setupOwnerWithHousehold()

    const { data: token, error } = await ownerClient.rpc('generate_invite')

    expect(error).toBeNull()
    expect(token).toBeTypeOf('string')
    expect((token as string).length).toBeGreaterThanOrEqual(16)

    const service = serviceClient()
    const { data: invite } = await service
      .from('invites')
      .select('*')
      .eq('token', token!)
      .single()

    expect(invite).toMatchObject({
      household_id: householdId,
      used_at: null,
    })
  })

  it('generating a second invite replaces the first (only one active at a time)', async () => {
    const { ownerClient, householdId } = await setupOwnerWithHousehold()

    const { data: token1 } = await ownerClient.rpc('generate_invite')
    const { data: token2 } = await ownerClient.rpc('generate_invite')

    expect(token1).not.toBe(token2)

    const service = serviceClient()
    const { data: invites } = await service
      .from('invites')
      .select('*')
      .eq('household_id', householdId)

    expect(invites).toHaveLength(1)
    expect(invites![0].token).toBe(token2)
  })

  it('a non-member cannot generate an invite for any household', async () => {
    await setupOwnerWithHousehold()

    const stranger = await createTestUser()
    const strangerClient = await authedClient(stranger.email, stranger.password)

    const { error } = await strangerClient.rpc('generate_invite')

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/not a member|household/i)
  })

  it('partner can accept a valid invite and becomes a member', async () => {
    const { ownerClient, householdId } = await setupOwnerWithHousehold()
    const { data: token } = await ownerClient.rpc('generate_invite')

    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)

    const { data: returnedHouseholdId, error } = await partnerClient.rpc(
      'accept_invite',
      { p_token: token! },
    )

    expect(error).toBeNull()
    expect(returnedHouseholdId).toBe(householdId)

    const service = serviceClient()
    const { data: members } = await service
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .order('role')

    expect(members).toHaveLength(2)
    expect(members!.map(m => m.role).sort()).toEqual(['owner', 'partner'])

    const { data: invite } = await service.from('invites').select('*').eq('token', token!).single()
    expect(invite!.used_at).not.toBeNull()
    expect(invite!.used_by_user_id).toBe(partner.id)
  })

  it('a used invite cannot be accepted again', async () => {
    const { ownerClient } = await setupOwnerWithHousehold()
    const { data: token } = await ownerClient.rpc('generate_invite')

    const partner1 = await createTestUser()
    const partner1Client = await authedClient(partner1.email, partner1.password)
    await partner1Client.rpc('accept_invite', { p_token: token! })

    const partner2 = await createTestUser()
    const partner2Client = await authedClient(partner2.email, partner2.password)
    const { error } = await partner2Client.rpc('accept_invite', { p_token: token! })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/used|invalid|expired/i)
  })

  it('an expired invite cannot be accepted', async () => {
    const { householdId, owner } = await setupOwnerWithHousehold()
    const service = serviceClient()
    // Insert an already-expired invite directly.
    await service.from('invites').insert({
      token: 'expired-token-xyz',
      household_id: householdId,
      created_by: owner.id,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })

    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)
    const { error } = await partnerClient.rpc('accept_invite', { p_token: 'expired-token-xyz' })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/expired|invalid/i)
  })

  it('an unknown token is rejected', async () => {
    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)
    const { error } = await partnerClient.rpc('accept_invite', { p_token: 'does-not-exist' })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/invalid|not found|unknown/i)
  })

  it('a user who is already in a household cannot accept an invite to another', async () => {
    const { ownerClient } = await setupOwnerWithHousehold()
    const { data: token } = await ownerClient.rpc('generate_invite')

    // Second user creates their own household first.
    const other = await createTestUser()
    const otherClient = await authedClient(other.email, other.password)
    await otherClient.rpc('create_household', { p_name: 'Other Home' })

    // Now they try to accept household 1's invite.
    const { error } = await otherClient.rpc('accept_invite', { p_token: token! })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/already a member|already in a household/i)
  })
})
