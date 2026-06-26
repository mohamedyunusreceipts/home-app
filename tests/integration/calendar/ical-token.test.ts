import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTestUser,
  authedClient,
  resetDatabase,
  serviceClient,
} from '@/tests/helpers/supabase'

describe('iCal feed token — rotate_ical_token RPC', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function makeHousehold(name: string) {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)
    const { data: householdId, error } = await client.rpc('create_household', {
      p_name: name,
    })
    if (error) throw new Error(`create_household failed: ${error.message}`)
    return { user, client, householdId: householdId as string }
  }

  it('mints a long random token for the caller household', async () => {
    const a = await makeHousehold('A')
    const { data: token, error } = await a.client.rpc('rotate_ical_token')
    expect(error).toBeNull()
    expect(typeof token).toBe('string')
    expect((token as string).length).toBeGreaterThanOrEqual(40)
    // URL-safe alphabet only (base64url).
    expect(token as string).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rotating replaces the prior token (upsert, one per household)', async () => {
    const a = await makeHousehold('A')
    const { data: first } = await a.client.rpc('rotate_ical_token')
    const { data: second } = await a.client.rpc('rotate_ical_token')
    expect(first).not.toBe(second)

    // Only one row exists for the household.
    const { data: rows } = await a.client
      .from('ical_feed_tokens')
      .select('token')
    expect(rows).toHaveLength(1)
    expect(rows![0]!.token).toBe(second)
  })

  it('the token resolves the correct household via a service-role lookup', async () => {
    const a = await makeHousehold('A')
    const { data: token } = await a.client.rpc('rotate_ical_token')

    const service = serviceClient()
    const { data: feed } = await service
      .from('ical_feed_tokens')
      .select('household_id')
      .eq('token', token as string)
      .maybeSingle<{ household_id: string }>()

    expect(feed?.household_id).toBe(a.householdId)
  })

  it("household B cannot read household A's feed token via RLS", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    await a.client.rpc('rotate_ical_token')

    const { data: bRows } = await b.client.from('ical_feed_tokens').select('*')
    expect(bRows).toHaveLength(0)
  })

  it('tokens are unique across households', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    const { data: tokenA } = await a.client.rpc('rotate_ical_token')
    const { data: tokenB } = await b.client.rpc('rotate_ical_token')
    expect(tokenA).not.toBe(tokenB)
  })
})
