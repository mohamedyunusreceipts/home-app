import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import { buildRrule } from '@/lib/rrule'

/**
 * RLS isolation for the settlement tables (0024_settlements): household B can
 * neither read nor write household A's settlements or settlement_plans, and a
 * member can insert a settlement in their own household.
 *
 * NOTE: written but NOT run here — the orchestrator applies migrations and CI
 * runs the full integration suite against the shared local DB.
 */
describe('RLS — settlements isolation (0024_settlements)', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function makeHousehold(name: string) {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)
    const { data: householdId, error } = await client.rpc('create_household', { p_name: name })
    if (error) throw new Error(`create_household failed: ${error.message}`)
    return { user, client, householdId: householdId as string }
  }

  it('a member can insert and read back a settlement in their household', async () => {
    const a = await makeHousehold('A')

    const { error: insertErr } = await a.client.from('settlements').insert({
      household_id: a.householdId,
      from_user_id: a.user.id,
      to_user_id: a.user.id,
      amount: 120,
      note: 'Test repayment',
      occurred_on: '2026-07-01',
    })
    expect(insertErr).toBeNull()

    const { data: rows } = await a.client.from('settlements').select('*')
    expect(rows).toHaveLength(1)
    expect(rows![0]!.amount).toBe('120.00')
  })

  it("household B cannot read or write household A's settlements", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('settlements').insert({
      household_id: a.householdId,
      from_user_id: a.user.id,
      to_user_id: a.user.id,
      amount: 50,
      occurred_on: '2026-07-01',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('settlements').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('settlements').insert({
      household_id: a.householdId,
      from_user_id: a.user.id,
      to_user_id: a.user.id,
      amount: 1,
      occurred_on: '2026-07-01',
    })
    expect(bWrite).not.toBeNull()
  })

  it("household B cannot read or write household A's settlement_plans", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    const rrule = buildRrule({ freq: 'monthly' })

    const { error: aInsert } = await a.client.from('settlement_plans').insert({
      household_id: a.householdId,
      from_user_id: a.user.id,
      to_user_id: a.user.id,
      installment_amount: 200,
      recurrence_rrule: rrule,
      next_due: '2026-08-01',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('settlement_plans').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('settlement_plans').insert({
      household_id: a.householdId,
      from_user_id: a.user.id,
      to_user_id: a.user.id,
      installment_amount: 1,
      recurrence_rrule: rrule,
      next_due: '2026-08-01',
    })
    expect(bWrite).not.toBeNull()
  })

  it('the amount check rejects a non-positive settlement', async () => {
    const a = await makeHousehold('A')
    const { error } = await a.client.from('settlements').insert({
      household_id: a.householdId,
      from_user_id: a.user.id,
      to_user_id: a.user.id,
      amount: 0,
      occurred_on: '2026-07-01',
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514') // check_violation
  })
})
