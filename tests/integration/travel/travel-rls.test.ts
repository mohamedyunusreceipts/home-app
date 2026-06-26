import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('RLS — travel isolation (§9.5)', () => {
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

  async function insertTrip(client: SupabaseClient, householdId: string, name = 'Lisbon') {
    return client
      .from('trips')
      .insert({
        household_id: householdId,
        name,
        destination: 'Lisbon, Portugal',
        start_date: '2026-09-01',
        end_date: '2026-09-10',
        status: 'booked',
        budget_total: 40_000,
      })
      .select()
      .single()
  }

  it('a household member can create a trip and read it back', async () => {
    const a = await makeHousehold('A')
    const { data, error } = await insertTrip(a.client, a.householdId)
    expect(error).toBeNull()
    expect(data!.household_id).toBe(a.householdId)

    const { data: rows } = await a.client.from('trips').select('*')
    expect(rows).toHaveLength(1)
    expect(rows![0]!.id).toBe(data!.id)
  })

  it("household B cannot read household A's trip", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    const { error } = await insertTrip(a.client, a.householdId)
    expect(error).toBeNull()

    const { data: bRows } = await b.client.from('trips').select('*')
    expect(bRows).toHaveLength(0)
  })

  it('household B cannot insert a trip into household A', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    const { error } = await insertTrip(b.client, a.householdId)
    expect(error).not.toBeNull()
  })

  it('the status check rejects an invalid trip status', async () => {
    const a = await makeHousehold('A')
    const { error } = await a.client.from('trips').insert({
      household_id: a.householdId,
      name: 'Bad',
      status: 'not_a_status',
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514') // check_violation
  })

  // A trip with one row in every child table: created + read by the owner, and
  // invisible/unwritable to another household.
  it('a trip with children is isolated across every child table', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { data: trip } = await insertTrip(a.client, a.householdId)
    const tripId = trip!.id as string

    // Itinerary item
    const { error: itinErr } = await a.client.from('trip_itinerary_items').insert({
      household_id: a.householdId,
      trip_id: tripId,
      day: '2026-09-02',
      time: '09:00',
      title: 'City walking tour',
      location: 'Alfama',
    })
    expect(itinErr).toBeNull()

    // Expense
    const { error: expErr } = await a.client.from('trip_expenses').insert({
      household_id: a.householdId,
      trip_id: tripId,
      date: '2026-09-02',
      amount: 1_200,
      category: 'Food',
      also_count_in_monthly_budget: true,
    })
    expect(expErr).toBeNull()

    // Packing list + item
    const { data: list, error: listErr } = await a.client
      .from('packing_lists')
      .insert({ household_id: a.householdId, trip_id: tripId, name: 'Carry-on' })
      .select()
      .single()
    expect(listErr).toBeNull()

    const { error: itemErr } = await a.client.from('packing_items').insert({
      household_id: a.householdId,
      list_id: list!.id,
      name: 'Passport',
      packed: false,
    })
    expect(itemErr).toBeNull()

    // Doc
    const { error: docErr } = await a.client.from('trip_docs').insert({
      household_id: a.householdId,
      trip_id: tripId,
      kind: 'passport',
      expiry_date: '2030-01-01',
    })
    expect(docErr).toBeNull()

    // Note
    const { error: noteErr } = await a.client.from('trip_notes').insert({
      household_id: a.householdId,
      trip_id: tripId,
      body_md: '# Lisbon notes',
    })
    expect(noteErr).toBeNull()

    // Outfit (wardrobe_item_ids is a uuid[] with NO FK — arbitrary uuids are fine)
    const { error: outfitErr } = await a.client.from('trip_outfits').insert({
      household_id: a.householdId,
      trip_id: tripId,
      day: '2026-09-02',
      wardrobe_item_ids: [
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
      ],
    })
    expect(outfitErr).toBeNull()

    // Owner reads everything back.
    for (const table of [
      'trip_itinerary_items',
      'trip_expenses',
      'packing_lists',
      'trip_docs',
      'trip_notes',
      'trip_outfits',
    ]) {
      const { data } = await a.client.from(table).select('*')
      expect(data, `${table} should be readable by owner`).toHaveLength(1)
    }
    const { data: itemsOwner } = await a.client.from('packing_items').select('*')
    expect(itemsOwner).toHaveLength(1)

    // Household B sees none of it.
    for (const table of [
      'trip_itinerary_items',
      'trip_expenses',
      'packing_lists',
      'packing_items',
      'trip_docs',
      'trip_notes',
      'trip_outfits',
    ]) {
      const { data } = await b.client.from(table).select('*')
      expect(data, `${table} should be invisible to household B`).toHaveLength(0)
    }

    // Household B cannot write a child into household A's trip.
    const { error: bWrite } = await b.client.from('trip_itinerary_items').insert({
      household_id: a.householdId,
      trip_id: tripId,
      day: '2026-09-03',
      title: 'Sneaky edit',
    })
    expect(bWrite).not.toBeNull()
  })

  it("household B cannot read household A's outfit ids", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    const { data: trip } = await insertTrip(a.client, a.householdId)

    await a.client.from('trip_outfits').insert({
      household_id: a.householdId,
      trip_id: trip!.id,
      day: '2026-09-02',
      wardrobe_item_ids: ['33333333-3333-3333-3333-333333333333'],
    })

    const { data: bRead } = await b.client.from('trip_outfits').select('*')
    expect(bRead).toHaveLength(0)
  })
})
