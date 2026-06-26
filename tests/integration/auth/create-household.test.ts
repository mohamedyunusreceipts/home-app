import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, serviceClient, resetDatabase } from '@/tests/helpers/supabase'

describe('create_household RPC', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('creates a household and adds the caller as owner', async () => {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)

    const { data, error } = await client.rpc('create_household', {
      p_name: 'Cosy Place',
    })

    expect(error).toBeNull()
    expect(data).toBeTypeOf('string') // returns the new household_id (uuid)

    const service = serviceClient()
    const { data: household } = await service
      .from('households')
      .select('*')
      .eq('id', data!)
      .single()

    expect(household).toMatchObject({
      name: 'Cosy Place',
      owner_user_id: user.id,
      currency: 'ZAR',
    })

    const { data: members } = await service
      .from('household_members')
      .select('*')
      .eq('household_id', data!)

    expect(members).toHaveLength(1)
    expect(members![0]).toMatchObject({
      household_id: data!,
      user_id: user.id,
      role: 'owner',
    })
  })

  it('rejects an empty household name', async () => {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)

    const { error } = await client.rpc('create_household', { p_name: '' })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/name/i)
  })

  it('rejects a call from an unauthenticated client', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { error } = await anonClient.rpc('create_household', { p_name: 'X' })

    expect(error).not.toBeNull()
  })

  it('rejects a second household for the same user', async () => {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)

    const { error: firstError } = await client.rpc('create_household', {
      p_name: 'First',
    })
    expect(firstError).toBeNull()

    const { error: secondError } = await client.rpc('create_household', {
      p_name: 'Second',
    })
    expect(secondError).not.toBeNull()
    expect(secondError!.message).toMatch(/already.*household|already a member/i)
  })

  it('the DB rejects a user belonging to two households (unique index backstop)', async () => {
    // Serialization backstop against a concurrent double-submit that slips past
    // the application-level count() check in create_household / accept_invite.
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)
    const { data: householdId } = await client.rpc('create_household', { p_name: 'First' })

    const service = serviceClient()
    const { data: otherHousehold } = await service
      .from('households')
      .insert({ name: 'Second', owner_user_id: user.id })
      .select('id')
      .single()

    const { error } = await service
      .from('household_members')
      .insert({ household_id: otherHousehold!.id, user_id: user.id, role: 'partner' })

    expect(error).not.toBeNull()
    expect(error!.code).toBe('23505') // unique_violation
    // The original membership is untouched.
    const { data: members } = await service
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
    expect(members).toHaveLength(1)
    expect(members![0]!.household_id).toBe(householdId)
  })
})
