import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import { computeTickOff } from '@/components/home/map'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('RLS — home management isolation', () => {
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

  // ── Per-table isolation ──────────────────────────────────────────────────────
  // Each table: owner can insert + read its own row; the other household sees
  // nothing and cannot write into the first household.

  it("isolates chores between households", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client
      .from('chores')
      .insert({ household_id: a.householdId, name: 'Bins' })
    expect(aInsert).toBeNull()

    const { data: aRows } = await a.client.from('chores').select('*')
    expect(aRows).toHaveLength(1)

    const { data: bRows } = await b.client.from('chores').select('*')
    expect(bRows).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('chores')
      .insert({ household_id: a.householdId, name: 'Sneaky' })
    expect(bWrite).not.toBeNull()
  })

  it("isolates cleaning_tasks between households", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client
      .from('cleaning_tasks')
      .insert({ household_id: a.householdId, name: 'Mop' })
    expect(aInsert).toBeNull()

    const { data: bRows } = await b.client.from('cleaning_tasks').select('*')
    expect(bRows).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('cleaning_tasks')
      .insert({ household_id: a.householdId, name: 'Sneaky' })
    expect(bWrite).not.toBeNull()
  })

  it("isolates maintenance_reminders between households", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client
      .from('maintenance_reminders')
      .insert({ household_id: a.householdId, item: 'Service geyser' })
    expect(aInsert).toBeNull()

    const { data: bRows } = await b.client.from('maintenance_reminders').select('*')
    expect(bRows).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('maintenance_reminders')
      .insert({ household_id: a.householdId, item: 'Sneaky' })
    expect(bWrite).not.toBeNull()
  })

  it("isolates home_projects between households", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client
      .from('home_projects')
      .insert({ household_id: a.householdId, name: 'Repaint' })
    expect(aInsert).toBeNull()

    const { data: bRows } = await b.client.from('home_projects').select('*')
    expect(bRows).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('home_projects')
      .insert({ household_id: a.householdId, name: 'Sneaky' })
    expect(bWrite).not.toBeNull()
  })

  it("isolates shared_lists between households", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('shared_lists').insert({
      household_id: a.householdId,
      name: 'Braai',
      items: [{ text: 'Charcoal', checked: false }],
    })
    expect(aInsert).toBeNull()

    const { data: bRows } = await b.client.from('shared_lists').select('*')
    expect(bRows).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('shared_lists')
      .insert({ household_id: a.householdId, name: 'Sneaky', items: [] })
    expect(bWrite).not.toBeNull()
  })

  it("isolates shopping_links between households", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client
      .from('shopping_links')
      .insert({ household_id: a.householdId, label: 'Vacuum', url: 'https://example.com' })
    expect(aInsert).toBeNull()

    const { data: bRows } = await b.client.from('shopping_links').select('*')
    expect(bRows).toHaveLength(0)

    const { error: bWrite } = await b.client
      .from('shopping_links')
      .insert({ household_id: a.householdId, label: 'Sneaky', url: 'https://evil.com' })
    expect(bWrite).not.toBeNull()
  })

  // ── Tick-off → next_due recurrence behavior ──────────────────────────────────
  // Inserts a chore with an RRULE, computes the tick-off patch via the shared
  // pure helper (the same path the server action uses), persists it, and asserts
  // next_due advanced and the done stamps landed.

  async function insertRecurringChore(client: SupabaseClient, householdId: string) {
    return client
      .from('chores')
      .insert({
        household_id: householdId,
        name: 'Water the plants',
        recurrence_rrule: 'FREQ=DAILY',
        next_due: '2026-06-26',
      })
      .select('id, recurrence_rrule, next_due, last_done_at')
      .single()
  }

  it('tick-off advances next_due via the RRULE and stamps last_done_*', async () => {
    const a = await makeHousehold('A')
    const now = new Date('2026-06-26T08:00:00.000Z')

    const { data: chore, error } = await insertRecurringChore(a.client, a.householdId)
    expect(error).toBeNull()
    expect(chore!.next_due).toBe('2026-06-26')

    // Mirror the server action's logic.
    const patch = computeTickOff(chore!.recurrence_rrule, a.user.id, now)
    expect(patch.next_due).toBe('2026-06-27') // advanced one day

    const { error: updateError } = await a.client
      .from('chores')
      .update(patch)
      .eq('id', chore!.id)
      .eq('household_id', a.householdId)
    expect(updateError).toBeNull()

    const { data: after } = await a.client
      .from('chores')
      .select('next_due, last_done_at, last_done_by')
      .eq('id', chore!.id)
      .single()

    expect(after!.next_due).toBe('2026-06-27')
    expect(after!.last_done_at).not.toBeNull()
    expect(after!.last_done_by).toBe(a.user.id)
  })

  it("another household cannot tick off household A's chore", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { data: chore } = await insertRecurringChore(a.client, a.householdId)
    const patch = computeTickOff(chore!.recurrence_rrule, b.user.id)

    // B's update is silently scoped out by RLS — zero rows affected, no error.
    const { data: updated } = await b.client
      .from('chores')
      .update(patch)
      .eq('id', chore!.id)
      .select('*')
    expect(updated).toHaveLength(0)

    // A's row is untouched.
    const { data: after } = await a.client
      .from('chores')
      .select('last_done_at')
      .eq('id', chore!.id)
      .single()
    expect(after!.last_done_at).toBeNull()
  })
})
