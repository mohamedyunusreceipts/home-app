import { describe, it, expect, beforeEach } from 'vitest'
import {
  serviceClient,
  createTestUser,
  authedClient,
  resetDatabase,
} from '@/tests/helpers/supabase'
import {
  createNotification,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
} from '@/lib/notifications'

/**
 * Notifications RLS + helper behaviour.
 *
 * Two users share ONE household so we prove isolation is per-USER, not just
 * per-household: user A must never see user B's notifications even though they
 * are housemates.
 */
describe('notifications — RLS + helpers', () => {
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

  async function sharedHousehold() {
    const userA = await createTestUser()
    const userB = await createTestUser()
    await waitForProfile(userA.id)
    await waitForProfile(userB.id)
    const service = serviceClient()

    const { data: household } = await service
      .from('households')
      .insert({ name: 'Shared', owner_user_id: userA.id })
      .select()
      .single()

    await service.from('household_members').insert([
      { household_id: household!.id, user_id: userA.id, role: 'owner' },
      { household_id: household!.id, user_id: userB.id, role: 'partner' },
    ])

    return { householdId: household!.id as string, userA, userB }
  }

  it('a user sees only their own notifications, not a housemate’s', async () => {
    const { householdId, userA, userB } = await sharedHousehold()
    const service = serviceClient()

    await service.from('notifications').insert([
      { household_id: householdId, user_id: userA.id, kind: 'test', title: 'For A' },
      { household_id: householdId, user_id: userB.id, kind: 'test', title: 'For B' },
    ])

    const aClient = await authedClient(userA.email, userA.password)
    const items = await listNotifications(aClient, { limit: 50 })

    expect(items).toHaveLength(1)
    expect(items[0]!.title).toBe('For A')
    expect(items.find((n) => n.title === 'For B')).toBeUndefined()
  })

  it('createNotification + unreadCount + markRead work for the owner', async () => {
    const { householdId, userA } = await sharedHousehold()
    const aClient = await authedClient(userA.email, userA.password)

    const created = await createNotification(aClient, {
      householdId,
      userId: userA.id,
      kind: 'mortgage.payment_due',
      title: 'Payment due',
      body: 'Your access-bond payment is due tomorrow.',
      link: '/mortgage',
    })

    expect(created.id).toBeTruthy()
    expect(created.read_at).toBeNull()
    expect(created.body).toBe('Your access-bond payment is due tomorrow.')

    expect(await unreadCount(aClient)).toBe(1)

    await markRead(aClient, [created.id])
    expect(await unreadCount(aClient)).toBe(0)

    // Still listed, just read.
    const items = await listNotifications(aClient)
    expect(items).toHaveLength(1)
    expect(items[0]!.read_at).not.toBeNull()
  })

  it('markAllRead clears only the calling user’s unread notifications', async () => {
    const { householdId, userA, userB } = await sharedHousehold()
    const service = serviceClient()

    await service.from('notifications').insert([
      { household_id: householdId, user_id: userA.id, kind: 'test', title: 'A1' },
      { household_id: householdId, user_id: userA.id, kind: 'test', title: 'A2' },
      { household_id: householdId, user_id: userB.id, kind: 'test', title: 'B1' },
    ])

    const aClient = await authedClient(userA.email, userA.password)
    expect(await unreadCount(aClient)).toBe(2)

    await markAllRead(aClient)
    expect(await unreadCount(aClient)).toBe(0)

    // User B's notification is untouched.
    const bClient = await authedClient(userB.email, userB.password)
    expect(await unreadCount(bClient)).toBe(1)
  })

  it('a user cannot insert a notification for another user (RLS check)', async () => {
    const { householdId, userA, userB } = await sharedHousehold()
    const aClient = await authedClient(userA.email, userA.password)

    const { error } = await aClient.from('notifications').insert({
      household_id: householdId,
      user_id: userB.id, // not the caller — must be rejected by WITH CHECK
      kind: 'test',
      title: 'sneaky',
    })

    expect(error).not.toBeNull()
  })
})
