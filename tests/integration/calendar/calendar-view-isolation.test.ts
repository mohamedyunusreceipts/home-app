import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * View-isolation test: v_calendar_all is declared `with (security_invoker = on)`,
 * so the underlying tables' RLS must apply to the querying user. This proves
 * household B cannot see household A's rows through the unioned view — the core
 * security property the security_invoker flag guarantees. Without that flag the
 * view would run as its owner and leak every household's data.
 */
describe('Calendar views — cross-household isolation (security_invoker)', () => {
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

  // Seed one row in every calendar source for a household, so v_calendar_all has
  // entries from each view.
  async function seedAllSources(client: SupabaseClient, householdId: string) {
    const errs: (string | null)[] = []
    const push = (e: { message: string } | null) => errs.push(e?.message ?? null)

    push(
      (
        await client.from('calendar_events').insert({
          household_id: householdId,
          title: 'Manual event',
          start: '2026-07-01T10:00:00.000Z',
          all_day: false,
        })
      ).error,
    )
    push(
      (
        await client.from('contacts').insert({
          household_id: householdId,
          name: 'Mum',
          dob: '1960-08-20',
        })
      ).error,
    )
    push(
      (
        await client.from('bills').insert({
          household_id: householdId,
          name: 'Rent',
          amount: 12000,
          next_due: '2026-07-05',
        })
      ).error,
    )
    push(
      (
        await client.from('chores').insert({
          household_id: householdId,
          name: 'Take out bins',
          next_due: '2026-07-02',
        })
      ).error,
    )
    push(
      (
        await client.from('maintenance_reminders').insert({
          household_id: householdId,
          item: 'Service geyser',
          next_due: '2026-07-10',
        })
      ).error,
    )
    push(
      (
        await client.from('meal_plan').insert({
          household_id: householdId,
          date: '2026-07-03',
          slot: 'dinner',
          free_text: 'Pasta',
        })
      ).error,
    )
    push(
      (
        await client.from('trips').insert({
          household_id: householdId,
          name: 'Cape Town',
          start_date: '2026-08-01',
          end_date: '2026-08-07',
          status: 'booked',
        })
      ).error,
    )

    for (const e of errs) expect(e).toBeNull()
  }

  it('a household sees all its own sources through v_calendar_all', async () => {
    const a = await makeHousehold('A')
    await seedAllSources(a.client, a.householdId)

    const { data: rows, error } = await a.client
      .from('v_calendar_all')
      .select('source, title, category')
    expect(error).toBeNull()

    const sources = new Set((rows ?? []).map((r) => r.source))
    expect(sources).toEqual(
      new Set(['manual', 'birthdays', 'bills', 'chores', 'maintenance', 'meals', 'trips']),
    )
    // Every row belongs to household A only.
    const { data: scoped } = await a.client
      .from('v_calendar_all')
      .select('household_id')
    for (const r of scoped ?? []) {
      expect(r.household_id).toBe(a.householdId)
    }
  })

  it("household B sees NONE of household A's rows through v_calendar_all", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    await seedAllSources(a.client, a.householdId)

    // B has seeded nothing — and security_invoker means A's rows are invisible.
    const { data: bRows, error } = await b.client
      .from('v_calendar_all')
      .select('household_id, source, title')
    expect(error).toBeNull()
    expect(bRows).toHaveLength(0)
  })

  it('each per-source view is also household-isolated', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    await seedAllSources(a.client, a.householdId)

    const views = [
      'v_calendar_bills',
      'v_calendar_chores',
      'v_calendar_meals',
      'v_calendar_trips',
      'v_calendar_birthdays',
      'v_calendar_maintenance',
    ]
    for (const view of views) {
      const { data: aRows } = await a.client.from(view).select('household_id')
      expect((aRows ?? []).length).toBeGreaterThan(0)

      const { data: bRows } = await b.client.from(view).select('household_id')
      expect(bRows).toHaveLength(0)
    }
  })
})
