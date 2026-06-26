import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'

describe('RLS — drive_folders isolation (§5.4)', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  // Create a user + their household via the create_household RPC; return an authed
  // client plus the household id.
  async function makeHousehold(name: string) {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)
    const { data: householdId, error } = await client.rpc('create_household', {
      p_name: name,
    })
    if (error) throw new Error(`create_household failed: ${error.message}`)
    return { user, client, householdId: householdId as string }
  }

  it('a household member can insert and read their own drive_folders rows', async () => {
    const a = await makeHousehold('A')

    const { data, error } = await a.client
      .from('drive_folders')
      .insert({
        household_id: a.householdId,
        path: '/HomeApp/Money/Receipts',
        drive_folder_id: 'drive-folder-aaa',
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data!.household_id).toBe(a.householdId)

    const { data: rows } = await a.client.from('drive_folders').select('*')
    expect(rows).toHaveLength(1)
    expect(rows![0]!.path).toBe('/HomeApp/Money/Receipts')
  })

  it("household B cannot read household A's drive_folders rows", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error } = await a.client.from('drive_folders').insert({
      household_id: a.householdId,
      path: '/HomeApp/Documents/Passports',
      drive_folder_id: 'drive-folder-secret',
    })
    expect(error).toBeNull()

    const { data: bRows } = await b.client.from('drive_folders').select('*')
    expect(bRows).toHaveLength(0)
  })

  it("household B cannot insert a drive_folders row into household A", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error } = await b.client.from('drive_folders').insert({
      household_id: a.householdId,
      path: '/HomeApp/Wardrobe/evil',
      drive_folder_id: 'drive-folder-evil',
    })
    expect(error).not.toBeNull()
  })

  it('the (household_id, path) unique constraint rejects a duplicate path', async () => {
    const a = await makeHousehold('A')

    const row = {
      household_id: a.householdId,
      path: '/HomeApp/Calendar/Attachments',
      drive_folder_id: 'drive-folder-cal',
    }

    const { error: first } = await a.client.from('drive_folders').insert(row)
    expect(first).toBeNull()

    const { error: dup } = await a.client
      .from('drive_folders')
      .insert({ ...row, drive_folder_id: 'a-different-id' })
    expect(dup).not.toBeNull()
    expect(dup!.code).toBe('23505') // unique_violation
  })

  it('the same path is allowed across different households', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const path = '/HomeApp/Money/Bills'
    const { error: aErr } = await a.client.from('drive_folders').insert({
      household_id: a.householdId,
      path,
      drive_folder_id: 'a-bills',
    })
    const { error: bErr } = await b.client.from('drive_folders').insert({
      household_id: b.householdId,
      path,
      drive_folder_id: 'b-bills',
    })
    expect(aErr).toBeNull()
    expect(bErr).toBeNull()
  })
})
