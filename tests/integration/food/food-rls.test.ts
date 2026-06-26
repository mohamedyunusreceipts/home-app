import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * RLS isolation for every Food table, plus an end-to-end check that the
 * deterministic grocery generator (meal plan → recipe ingredients vs pantry)
 * produces the expected grocery_items.
 *
 * Migrations + this suite are applied/run centrally by the orchestrator.
 */
describe('RLS — food isolation', () => {
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

  async function insertRecipe(client: SupabaseClient, householdId: string, name = 'Pasta') {
    return client
      .from('recipes')
      .insert({ household_id: householdId, name, servings: 2, tags: ['quick'] })
      .select()
      .single()
  }

  it('a member can insert and read their own recipe; the other household cannot', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { data: recipe, error } = await insertRecipe(a.client, a.householdId)
    expect(error).toBeNull()
    expect(recipe!.household_id).toBe(a.householdId)

    const { data: aRows } = await a.client.from('recipes').select('*')
    expect(aRows).toHaveLength(1)

    const { data: bRows } = await b.client.from('recipes').select('*')
    expect(bRows).toHaveLength(0)
  })

  it("household B cannot insert into household A's tables", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const attempts = [
      b.client.from('recipes').insert({ household_id: a.householdId, name: 'X' }),
      b.client.from('pantry_items').insert({ household_id: a.householdId, name: 'Milk' }),
      b.client
        .from('grocery_items')
        .insert({ household_id: a.householdId, name: 'Bread', source: 'manual' }),
      b.client
        .from('meal_plan')
        .insert({ household_id: a.householdId, date: '2026-06-01', slot: 'dinner', free_text: 'X' }),
      b.client
        .from('leftovers')
        .insert({ household_id: a.householdId, name: 'Soup', consume_by: '2026-06-05' }),
    ]
    for (const attempt of attempts) {
      const { error } = await attempt
      expect(error).not.toBeNull()
    }
  })

  it('isolates recipe_ingredients via the parent recipe', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { data: recipe } = await insertRecipe(a.client, a.householdId)
    const { error: aInsert } = await a.client.from('recipe_ingredients').insert({
      household_id: a.householdId,
      recipe_id: recipe!.id,
      name: 'Tomato',
      qty: 3,
      unit: 'ea',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('recipe_ingredients').select('*')
    expect(bRead).toHaveLength(0)
  })

  it('enforces the meal_plan slot check and per-slot uniqueness', async () => {
    const a = await makeHousehold('A')

    const { error: badSlot } = await a.client.from('meal_plan').insert({
      household_id: a.householdId,
      date: '2026-06-01',
      slot: 'brunch',
      free_text: 'Eggs',
    })
    expect(badSlot).not.toBeNull()
    expect(badSlot!.code).toBe('23514') // check_violation

    const { error: first } = await a.client.from('meal_plan').insert({
      household_id: a.householdId,
      date: '2026-06-01',
      slot: 'dinner',
      free_text: 'Pasta',
    })
    expect(first).toBeNull()

    const { error: dup } = await a.client.from('meal_plan').insert({
      household_id: a.householdId,
      date: '2026-06-01',
      slot: 'dinner',
      free_text: 'Curry',
    })
    expect(dup).not.toBeNull()
    expect(dup!.code).toBe('23505') // unique_violation (partial index)
  })

  it('rejects an invalid grocery source', async () => {
    const a = await makeHousehold('A')
    const { error } = await a.client
      .from('grocery_items')
      .insert({ household_id: a.householdId, name: 'Eggs', source: 'imported' })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514') // check_violation
  })

  it('end-to-end: meal plan ingredients minus pantry → grocery list (generator parity)', async () => {
    const { generateGroceryList } = await import('@/components/food/grocery-gen')
    const a = await makeHousehold('A')

    // A recipe with ingredients, planned for a day this week.
    const { data: recipe } = await insertRecipe(a.client, a.householdId, 'Bolognese')
    await a.client.from('recipe_ingredients').insert([
      { household_id: a.householdId, recipe_id: recipe!.id, name: 'Mince', qty: 500, unit: 'g' },
      { household_id: a.householdId, recipe_id: recipe!.id, name: 'Pasta', qty: 400, unit: 'g' },
      { household_id: a.householdId, recipe_id: recipe!.id, name: 'Onion', qty: 2, unit: 'ea' },
    ])
    await a.client.from('meal_plan').insert({
      household_id: a.householdId,
      date: '2026-06-22',
      slot: 'dinner',
      recipe_id: recipe!.id,
    })
    // Pantry already has the pasta and one onion.
    await a.client.from('pantry_items').insert([
      { household_id: a.householdId, name: 'Pasta', qty: 1000, unit: 'g' },
      { household_id: a.householdId, name: 'Onion', qty: 1, unit: 'ea' },
    ])

    // Pull the planned recipe's ingredients + pantry back out (as the action does).
    const { data: ingredients } = await a.client
      .from('recipe_ingredients')
      .select('name, qty, unit')
      .eq('recipe_id', recipe!.id)
    const { data: pantry } = await a.client.from('pantry_items').select('name, qty, unit')

    const lines = generateGroceryList(ingredients ?? [], pantry ?? [])
    // Mince in full (500g), Onion shortfall (1), Pasta fully covered → dropped.
    expect(lines).toContainEqual({ name: 'Mince', qty: 500, unit: 'g' })
    expect(lines).toContainEqual({ name: 'Onion', qty: 1, unit: 'ea' })
    expect(lines).not.toContainEqual(expect.objectContaining({ name: 'Pasta' }))

    // Insert as the action would, with source='meal_plan'.
    const rows = lines.map((l) => ({
      household_id: a.householdId,
      name: l.name,
      qty: l.qty,
      unit: l.unit,
      source: 'meal_plan' as const,
      added_by_user_id: a.user.id,
    }))
    const { error: insErr } = await a.client.from('grocery_items').insert(rows)
    expect(insErr).toBeNull()

    const { data: list } = await a.client
      .from('grocery_items')
      .select('name, source')
      .eq('source', 'meal_plan')
    expect(list).toHaveLength(2)
    expect((list ?? []).map((r) => r.name).sort()).toEqual(['Mince', 'Onion'])
  })
})
