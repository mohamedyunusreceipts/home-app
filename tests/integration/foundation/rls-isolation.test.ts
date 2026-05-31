import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'

describe('RLS — foundation isolation', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function makeHousehold(name: string) {
    const owner = await createTestUser()
    const partner = await createTestUser()
    const service = serviceClient()

    const { data: household } = await service
      .from('households')
      .insert({ name, owner_user_id: owner.id })
      .select()
      .single()

    await service.from('household_members').insert([
      { household_id: household!.id, user_id: owner.id, role: 'owner' },
      { household_id: household!.id, user_id: partner.id, role: 'partner' },
    ])

    return { household: household!, owner, partner }
  }

  it('user in household A cannot see household B in households table', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { data, error } = await aClient.from('households').select('*')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(a.household.id)
    expect(data!.find(h => h.id === b.household.id)).toBeUndefined()
  })

  it('user in household A cannot see household B members', async () => {
    const a = await makeHousehold('A')
    await makeHousehold('B')

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { data } = await aClient.from('household_members').select('*')

    expect(data!.every(m => m.household_id === a.household.id)).toBe(true)
  })

  it('user in household A cannot see household B invites', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    const service = serviceClient()

    await service.from('invites').insert({
      token: 'b-secret-token',
      household_id: b.household.id,
      created_by: b.owner.id,
    })

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { data } = await aClient.from('invites').select('*')

    expect(data!.find(i => i.token === 'b-secret-token')).toBeUndefined()
  })

  it('user in household A cannot insert into household B', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { error } = await aClient
      .from('invites')
      .insert({
        token: 'malicious',
        household_id: b.household.id,
        created_by: a.owner.id,
      })

    expect(error).not.toBeNull()
  })

  it('any authenticated user can read their own profile only', async () => {
    const a = await makeHousehold('A')
    await makeHousehold('B')

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { data } = await aClient.from('profiles').select('*')

    // a.owner should see their own profile, and also a.partner (same household)
    // but NOT b.owner or b.partner
    expect(data!.map(p => p.id).sort()).toEqual([a.owner.id, a.partner.id].sort())
  })
})
