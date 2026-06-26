import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTestUser,
  authedClient,
  serviceClient,
  resetDatabase,
} from '@/tests/helpers/supabase'
import {
  checkAndIncrement,
  getUsage,
  currentMonth,
  DEFAULT_MONTHLY_CAP,
} from '@/lib/ai/usage'

/**
 * Integration tests for the AI usage cap against the real local `ai_usage`
 * table (migration 0011). Households are created via the `create_household` RPC
 * per the spec, so the authed client's RLS context matches production.
 */
describe('AI usage cap — ai_usage', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function makeHousehold() {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)
    const { data: householdId, error } = await client.rpc('create_household', {
      p_name: `H-${user.id.slice(0, 8)}`,
    })
    if (error || !householdId) throw new Error(`create_household failed: ${error?.message}`)
    return { user, client, householdId: householdId as string }
  }

  it('increments calls per household for the current month', async () => {
    const { client, householdId } = await makeHousehold()
    const month = currentMonth()

    expect(await getUsage(client, householdId, month)).toBe(0)

    const first = await checkAndIncrement(client, householdId)
    expect(first).toEqual({ allowed: true, used: 1, cap: DEFAULT_MONTHLY_CAP })

    const second = await checkAndIncrement(client, householdId)
    expect(second).toEqual({ allowed: true, used: 2, cap: DEFAULT_MONTHLY_CAP })

    expect(await getUsage(client, householdId, month)).toBe(2)
  })

  it('enforces the cap: the (cap+1)th call is rejected without incrementing', async () => {
    const { client, householdId } = await makeHousehold()
    const month = currentMonth()
    const cap = 3 // small cap to keep the test fast

    for (let i = 1; i <= cap; i++) {
      const r = await checkAndIncrement(client, householdId, cap)
      expect(r).toEqual({ allowed: true, used: i, cap })
    }

    const over = await checkAndIncrement(client, householdId, cap)
    expect(over).toEqual({ allowed: false, used: cap, cap })
    // The rejected call did not bump the counter.
    expect(await getUsage(client, householdId, month)).toBe(cap)
  })

  it('tracks usage independently per household', async () => {
    const a = await makeHousehold()
    const b = await makeHousehold()

    await checkAndIncrement(a.client, a.householdId)
    await checkAndIncrement(a.client, a.householdId)
    await checkAndIncrement(b.client, b.householdId)

    const month = currentMonth()
    expect(await getUsage(serviceClient(), a.householdId, month)).toBe(2)
    expect(await getUsage(serviceClient(), b.householdId, month)).toBe(1)
  })

  it('RLS: a household cannot read another household ai_usage row', async () => {
    const a = await makeHousehold()
    const b = await makeHousehold()

    // Seed both households' counters via the service (bypasses RLS for setup).
    const service = serviceClient()
    const month = currentMonth()
    await service.from('ai_usage').insert([
      { household_id: a.householdId, month, calls: 5 },
      { household_id: b.householdId, month, calls: 7 },
    ])

    // Household A's authed client should see only its own row.
    const { data, error } = await a.client.from('ai_usage').select('*')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]!.household_id).toBe(a.householdId)
    expect(data!.find((r) => r.household_id === b.householdId)).toBeUndefined()

    // getUsage through A's client cannot read B's counter.
    expect(await getUsage(a.client, b.householdId, month)).toBe(0)
  })
})
