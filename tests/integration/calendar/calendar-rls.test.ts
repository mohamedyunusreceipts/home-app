import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('RLS — calendar_events + contacts isolation', () => {
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

  function insertEvent(client: SupabaseClient, householdId: string) {
    return client
      .from('calendar_events')
      .insert({
        household_id: householdId,
        title: 'Anniversary dinner',
        start: '2026-07-01T18:00:00.000Z',
        end: '2026-07-01T20:00:00.000Z',
        all_day: false,
      })
      .select()
      .single()
  }

  function insertContact(client: SupabaseClient, householdId: string) {
    return client
      .from('contacts')
      .insert({
        household_id: householdId,
        name: 'Gran',
        dob: '1950-03-14',
        relationship: 'Grandmother',
      })
      .select()
      .single()
  }

  it('a member can insert and read their own calendar_events', async () => {
    const a = await makeHousehold('A')
    const { data, error } = await insertEvent(a.client, a.householdId)
    expect(error).toBeNull()
    expect(data!.household_id).toBe(a.householdId)

    const { data: rows } = await a.client.from('calendar_events').select('*')
    expect(rows).toHaveLength(1)
  })

  it("household B cannot read household A's calendar_events", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    await insertEvent(a.client, a.householdId)

    const { data: bRows } = await b.client.from('calendar_events').select('*')
    expect(bRows).toHaveLength(0)
  })

  it("household B cannot insert a calendar_event into household A", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    const { error } = await insertEvent(b.client, a.householdId)
    expect(error).not.toBeNull()
  })

  it('a member can insert and read their own contacts', async () => {
    const a = await makeHousehold('A')
    const { error } = await insertContact(a.client, a.householdId)
    expect(error).toBeNull()

    const { data: rows } = await a.client.from('contacts').select('*')
    expect(rows).toHaveLength(1)
  })

  it("household B cannot read household A's contacts", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    await insertContact(a.client, a.householdId)

    const { data: bRows } = await b.client.from('contacts').select('*')
    expect(bRows).toHaveLength(0)
  })
})
