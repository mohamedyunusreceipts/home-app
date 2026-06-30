import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'

describe('RLS — salaah isolation (0021_salaah)', () => {
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

  it('a member can upsert and read back their salaah_settings row', async () => {
    const a = await makeHousehold('A')

    const { error: upsertErr } = await a.client.from('salaah_settings').upsert(
      {
        household_id: a.householdId,
        latitude: -33.9249,
        longitude: 18.4241,
        location_name: 'Cape Town',
        timezone: 'Africa/Johannesburg',
        method: 'MuslimWorldLeague',
        madhab: 'shafi',
        push_enabled: true,
      },
      { onConflict: 'household_id' },
    )
    expect(upsertErr).toBeNull()

    const { data: rows } = await a.client.from('salaah_settings').select('*')
    expect(rows).toHaveLength(1)
    expect(rows![0]!.location_name).toBe('Cape Town')
    // Default prayers jsonb applied.
    expect(rows![0]!.prayers).toEqual({
      fajr: true,
      dhuhr: true,
      asr: true,
      maghrib: true,
      isha: true,
    })
  })

  it("household B cannot read household A's salaah_settings", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    await a.client.from('salaah_settings').upsert(
      { household_id: a.householdId, latitude: -26.2, longitude: 28.04, push_enabled: true },
      { onConflict: 'household_id' },
    )

    const { data: bRows } = await b.client.from('salaah_settings').select('*')
    expect(bRows).toHaveLength(0)
  })

  it('household B cannot insert salaah_settings for household A', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error } = await b.client
      .from('salaah_settings')
      .insert({ household_id: a.householdId, latitude: 0, longitude: 0 })
    expect(error).not.toBeNull()
  })

  it('salaah_notify_log is tenant-isolated and dedupes via the unique constraint', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: insErr } = await a.client.from('salaah_notify_log').insert({
      household_id: a.householdId,
      prayer_date: '2026-06-30',
      prayer: 'fajr',
    })
    expect(insErr).toBeNull()

    // Same (household, date, prayer) again → unique_violation.
    const { error: dupErr } = await a.client.from('salaah_notify_log').insert({
      household_id: a.householdId,
      prayer_date: '2026-06-30',
      prayer: 'fajr',
    })
    expect(dupErr).not.toBeNull()
    expect(dupErr!.code).toBe('23505')

    // Household B sees none of A's log rows.
    const { data: bLog } = await b.client.from('salaah_notify_log').select('*')
    expect(bLog).toHaveLength(0)
  })
})
