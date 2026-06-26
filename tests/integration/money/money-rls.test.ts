import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * RLS isolation per Money table (design spec §11): household B can neither read
 * nor write household A's rows. One read + one write check per table.
 *
 * NOTE: written but NOT run here — the orchestrator applies migrations and runs
 * the full integration suite centrally against the shared local DB.
 */
describe('RLS — money isolation', () => {
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

  async function insertExpense(client: SupabaseClient, householdId: string, paidBy: string) {
    return client
      .from('expenses')
      .insert({
        household_id: householdId,
        date: '2026-06-01',
        amount: 100,
        category: 'Groceries',
        paid_by_user_id: paidBy,
        split_type: 'equal',
        description: 'Test shop',
      })
      .select()
      .single()
  }

  it("household B cannot read or write household A's expenses", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await insertExpense(a.client, a.householdId, a.user.id)
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('expenses').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await insertExpense(b.client, a.householdId, a.user.id)
    expect(bWrite).not.toBeNull()
  })

  it("household B cannot read or write household A's expense_splits", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { data: expense } = await insertExpense(a.client, a.householdId, a.user.id)

    const { error: aInsert } = await a.client.from('expense_splits').insert({
      household_id: a.householdId,
      expense_id: expense!.id,
      user_id: a.user.id,
      share_amount: 50,
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('expense_splits').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('expense_splits').insert({
      household_id: a.householdId,
      expense_id: expense!.id,
      user_id: a.user.id,
      share_amount: 50,
    })
    expect(bWrite).not.toBeNull()
  })

  it("household B cannot read or write household A's bills", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client
      .from('bills')
      .insert({ household_id: a.householdId, name: 'Rent', amount: 12000 })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('bills').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('bills')
      .insert({ household_id: a.householdId, name: 'Hijack', amount: 1 })
    expect(bWrite).not.toBeNull()
  })

  it("household B cannot read or write household A's subscriptions", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client
      .from('subscriptions')
      .insert({ household_id: a.householdId, name: 'Netflix', amount: 199 })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('subscriptions').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('subscriptions')
      .insert({ household_id: a.householdId, name: 'Hijack', amount: 1 })
    expect(bWrite).not.toBeNull()
  })

  it("household B cannot read or write household A's budgets", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('budgets').insert({
      household_id: a.householdId,
      month: '2026-06-01',
      category: 'Groceries',
      limit_amount: 3000,
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('budgets').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('budgets').insert({
      household_id: a.householdId,
      month: '2026-07-01',
      category: 'Dining',
      limit_amount: 1000,
    })
    expect(bWrite).not.toBeNull()
  })

  it("household B cannot read or write household A's savings_goals", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client
      .from('savings_goals')
      .insert({ household_id: a.householdId, name: 'Holiday', target: 20000, current: 5000 })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('savings_goals').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('savings_goals')
      .insert({ household_id: a.householdId, name: 'Hijack', target: 1 })
    expect(bWrite).not.toBeNull()
  })

  it('the (household, month, category) unique constraint rejects a duplicate budget', async () => {
    const a = await makeHousehold('A')
    const budget = {
      household_id: a.householdId,
      month: '2026-06-01',
      category: 'Groceries',
      limit_amount: 3000,
    }
    const { error: first } = await a.client.from('budgets').insert(budget)
    expect(first).toBeNull()
    const { error: dup } = await a.client.from('budgets').insert(budget)
    expect(dup).not.toBeNull()
    expect(dup!.code).toBe('23505') // unique_violation
  })

  it('the split_type check rejects an invalid value', async () => {
    const a = await makeHousehold('A')
    const { error } = await a.client.from('expenses').insert({
      household_id: a.householdId,
      date: '2026-06-01',
      amount: 100,
      category: 'Groceries',
      paid_by_user_id: a.user.id,
      split_type: 'not_a_real_split',
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514') // check_violation
  })
})
