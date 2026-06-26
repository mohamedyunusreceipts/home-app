import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'

/**
 * RLS isolation + seed-trigger + case-insensitive uniqueness for the
 * Meals & Desserts catalogue (catalogue_items, migration 0020).
 */
describe('RLS — catalogue isolation', () => {
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

  it('seeds the default catalogue when a household is created', async () => {
    const a = await makeHousehold('A')

    const { data: desserts, error: dErr } = await a.client
      .from('catalogue_items')
      .select('id', { count: 'exact' })
      .eq('kind', 'dessert')
    expect(dErr).toBeNull()
    expect(desserts).toHaveLength(30)

    const { data: food, error: fErr } = await a.client
      .from('catalogue_items')
      .select('id')
      .eq('kind', 'food')
    expect(fErr).toBeNull()
    expect(food).toHaveLength(45)
  })

  it("household B cannot read or write household A's catalogue_items", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    // B sees only its own rows, never A's.
    const { data: aRowsFromB } = await b.client
      .from('catalogue_items')
      .select('id')
      .eq('household_id', a.householdId)
    expect(aRowsFromB).toHaveLength(0)

    // B cannot insert into A's household.
    const { error: insErr } = await b.client
      .from('catalogue_items')
      .insert({ household_id: a.householdId, kind: 'food', name: 'Sneaky dish' })
    expect(insErr).not.toBeNull()

    // B cannot delete A's rows: read A's id with A's client, attempt delete with B.
    const { data: aRow } = await a.client
      .from('catalogue_items')
      .select('id')
      .eq('kind', 'food')
      .limit(1)
      .single()
    const { count: beforeCount } = await a.client
      .from('catalogue_items')
      .select('id', { count: 'exact', head: true })

    await b.client.from('catalogue_items').delete().eq('id', aRow!.id)

    const { count: afterCount } = await a.client
      .from('catalogue_items')
      .select('id', { count: 'exact', head: true })
    expect(afterCount).toBe(beforeCount)
  })

  it('rejects a case-insensitive duplicate name within the same kind (23505)', async () => {
    const a = await makeHousehold('A')

    const { error: first } = await a.client
      .from('catalogue_items')
      .insert({ household_id: a.householdId, kind: 'food', name: 'Zzz unique dish' })
    expect(first).toBeNull()

    const { error: dup } = await a.client
      .from('catalogue_items')
      .insert({ household_id: a.householdId, kind: 'food', name: 'ZZZ UNIQUE DISH' })
    expect(dup).not.toBeNull()
    expect(dup!.code).toBe('23505')
  })
})
