import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('RLS — mortgage isolation', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  // Create a user, their household (via the create_household RPC), and return an
  // authed client plus identifiers other rows can hang off.
  async function makeHousehold(name: string) {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)
    const { data: householdId, error } = await client.rpc('create_household', { p_name: name })
    if (error) throw new Error(`create_household failed: ${error.message}`)
    return { user, client, householdId: householdId as string }
  }

  async function insertMortgage(client: SupabaseClient, householdId: string) {
    return client
      .from('mortgages')
      .insert({
        household_id: householdId,
        lender: 'ABSA',
        original_principal: 1_500_000,
        start_date: '2024-01-01',
        term_months: 240,
        contractual_instalment: 14_500,
        current_annual_rate: 11.75,
      })
      .select()
      .single()
  }

  it('a household member can insert and read their own mortgage', async () => {
    const a = await makeHousehold('A')

    const { data, error } = await insertMortgage(a.client, a.householdId)
    expect(error).toBeNull()
    expect(data!.household_id).toBe(a.householdId)

    const { data: rows } = await a.client.from('mortgages').select('*')
    expect(rows).toHaveLength(1)
    expect(rows![0]!.id).toBe(data!.id)
  })

  it("household B cannot read household A's mortgage", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error } = await insertMortgage(a.client, a.householdId)
    expect(error).toBeNull()

    const { data: bRows } = await b.client.from('mortgages').select('*')
    expect(bRows).toHaveLength(0)
  })

  it("household B cannot insert a mortgage into household A", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error } = await insertMortgage(b.client, a.householdId)
    expect(error).not.toBeNull()
  })

  it("household B cannot read or write household A's statements", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { data: mortgage } = await insertMortgage(a.client, a.householdId)

    const { error: aInsert } = await a.client.from('mortgage_statements').insert({
      household_id: a.householdId,
      mortgage_id: mortgage!.id,
      statement_month: '2024-02-01',
      closing_balance: 1_490_000,
      interest_charged: 14_000,
      annual_rate: 11.75,
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('mortgage_statements').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('mortgage_statements').insert({
      household_id: a.householdId,
      mortgage_id: mortgage!.id,
      statement_month: '2024-03-01',
      closing_balance: 1_480_000,
      interest_charged: 13_900,
      annual_rate: 11.75,
    })
    expect(bWrite).not.toBeNull()
  })

  it("household B cannot read or write household A's transactions", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { data: mortgage } = await insertMortgage(a.client, a.householdId)

    const { error: aInsert } = await a.client.from('mortgage_transactions').insert({
      household_id: a.householdId,
      mortgage_id: mortgage!.id,
      occurred_on: '2024-02-15',
      amount: 5_000,
      kind: 'extra_deposit',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('mortgage_transactions').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('mortgage_transactions').insert({
      household_id: a.householdId,
      mortgage_id: mortgage!.id,
      occurred_on: '2024-02-16',
      amount: 5_000,
      kind: 'withdrawal',
    })
    expect(bWrite).not.toBeNull()
  })

  it('the one-bond-per-household unique index rejects a second mortgage', async () => {
    const a = await makeHousehold('A')

    const { error: first } = await insertMortgage(a.client, a.householdId)
    expect(first).toBeNull()

    const { error: second } = await insertMortgage(a.client, a.householdId)
    expect(second).not.toBeNull()
    expect(second!.code).toBe('23505') // unique_violation
  })

  it('the (mortgage_id, statement_month) unique constraint rejects a duplicate month', async () => {
    const a = await makeHousehold('A')
    const { data: mortgage } = await insertMortgage(a.client, a.householdId)

    const statement = {
      household_id: a.householdId,
      mortgage_id: mortgage!.id,
      statement_month: '2024-02-01',
      closing_balance: 1_490_000,
      interest_charged: 14_000,
      annual_rate: 11.75,
    }

    const { error: first } = await a.client.from('mortgage_statements').insert(statement)
    expect(first).toBeNull()

    const { error: dup } = await a.client.from('mortgage_statements').insert(statement)
    expect(dup).not.toBeNull()
    expect(dup!.code).toBe('23505') // unique_violation
  })

  it('the kind check rejects an invalid transaction kind', async () => {
    const a = await makeHousehold('A')
    const { data: mortgage } = await insertMortgage(a.client, a.householdId)

    const { error } = await a.client.from('mortgage_transactions').insert({
      household_id: a.householdId,
      mortgage_id: mortgage!.id,
      occurred_on: '2024-02-15',
      amount: 5_000,
      kind: 'not_a_real_kind',
    })

    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514') // check_violation
  })
})
