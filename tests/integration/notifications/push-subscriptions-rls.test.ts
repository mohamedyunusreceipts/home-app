import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import {
  serviceClient,
  createTestUser,
  authedClient,
  resetDatabase,
} from '@/tests/helpers/supabase'

describe('push_subscriptions — RLS + uniqueness', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  /** Wait until the auth-trigger-created profile row exists (avoids FK races). */
  async function waitForProfile(id: string) {
    const service = serviceClient()
    for (let i = 0; i < 50; i++) {
      const { data } = await service.from('profiles').select('id').eq('id', id).maybeSingle()
      if (data) return
      await new Promise((r) => setTimeout(r, 50))
    }
    throw new Error(`profile ${id} never appeared`)
  }

  async function twoUsers() {
    const userA = await createTestUser()
    const userB = await createTestUser()
    // push_subscriptions references profiles (created by the auth trigger);
    // wait for those rows so the FK insert never races the trigger.
    await waitForProfile(userA.id)
    await waitForProfile(userB.id)
    return { userA, userB }
  }

  it('a user manages only their own subscriptions', async () => {
    const { userA, userB } = await twoUsers()
    const service = serviceClient()

    const aEndpoint = `https://push.example/${randomUUID()}`
    const bEndpoint = `https://push.example/${randomUUID()}`
    await service.from('push_subscriptions').insert([
      { user_id: userA.id, endpoint: aEndpoint, p256dh: 'a-key', auth: 'a-auth' },
      { user_id: userB.id, endpoint: bEndpoint, p256dh: 'b-key', auth: 'b-auth' },
    ])

    const aClient = await authedClient(userA.email, userA.password)
    const { data } = await aClient.from('push_subscriptions').select('*')

    expect(data).toHaveLength(1)
    expect(data![0]!.endpoint).toBe(aEndpoint)
  })

  it('a user cannot insert a subscription owned by someone else', async () => {
    const { userA, userB } = await twoUsers()
    const aClient = await authedClient(userA.email, userA.password)

    const { error } = await aClient.from('push_subscriptions').insert({
      user_id: userB.id, // WITH CHECK must reject
      endpoint: `https://push.example/${randomUUID()}`,
      p256dh: 'x',
      auth: 'y',
    })

    expect(error).not.toBeNull()
  })

  it('endpoint is unique across the table', async () => {
    const { userA } = await twoUsers()
    const service = serviceClient()
    const endpoint = `https://push.example/${randomUUID()}`

    const first = await service
      .from('push_subscriptions')
      .insert({ user_id: userA.id, endpoint, p256dh: 'k1', auth: 'a1' })
    expect(first.error).toBeNull()

    const second = await service
      .from('push_subscriptions')
      .insert({ user_id: userA.id, endpoint, p256dh: 'k2', auth: 'a2' })
    expect(second.error).not.toBeNull()
    expect(second.error!.code).toBe('23505') // unique_violation
  })

  it('a user can delete their own subscription by endpoint', async () => {
    const { userA } = await twoUsers()
    const service = serviceClient()
    const endpoint = `https://push.example/${randomUUID()}`
    await service
      .from('push_subscriptions')
      .insert({ user_id: userA.id, endpoint, p256dh: 'k', auth: 'a' })

    const aClient = await authedClient(userA.email, userA.password)
    const { error } = await aClient
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
    expect(error).toBeNull()

    const { data } = await aClient.from('push_subscriptions').select('*')
    expect(data).toHaveLength(0)
  })
})
