import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import {
  serviceClient,
  createTestUser,
  resetDatabase,
} from '@/tests/helpers/supabase'

/**
 * `sendPushToUser` pruning logic.
 *
 * We mock `web-push` so NO real network calls are made: one endpoint "succeeds",
 * one returns a 410 (gone), one returns a 500 (transient). We then assert:
 *   - the 410 subscription is pruned from the DB,
 *   - the successful + transient subscriptions are kept,
 *   - the returned counters are correct.
 *
 * VAPID env is set to ephemeral generated keys so config-reading passes; the
 * real send is intercepted by the mock, so the keys are never used on the wire.
 */

// --- web-push mock -----------------------------------------------------------
const sendNotificationMock = vi.fn()

class FakeWebPushError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'WebPushError'
    this.statusCode = statusCode
  }
}

vi.mock('web-push', () => {
  return {
    default: {
      setVapidDetails: vi.fn(),
      sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
    },
    WebPushError: FakeWebPushError,
  }
})

// Import AFTER the mock is registered.
const { sendPushToUser } = await import('@/lib/notifications/push')

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

describe('sendPushToUser — pruning + counters', () => {
  beforeEach(async () => {
    await resetDatabase()
    sendNotificationMock.mockReset()
    process.env.VAPID_PUBLIC_KEY = 'BPublicKeyForTest_'.padEnd(87, 'x')
    process.env.VAPID_PRIVATE_KEY = 'PrivateKeyForTest_'.padEnd(43, 'y')
    process.env.VAPID_SUBJECT = 'mailto:test@example.com'
  })

  it('prunes dead (410) subscriptions and keeps the rest', async () => {
    const user = await createTestUser()
    await waitForProfile(user.id)
    const service = serviceClient()

    const goodEndpoint = `https://push.example/good-${randomUUID()}`
    const goneEndpoint = `https://push.example/gone-${randomUUID()}`
    const transientEndpoint = `https://push.example/err-${randomUUID()}`

    await service.from('push_subscriptions').insert([
      { user_id: user.id, endpoint: goodEndpoint, p256dh: 'k1', auth: 'a1' },
      { user_id: user.id, endpoint: goneEndpoint, p256dh: 'k2', auth: 'a2' },
      { user_id: user.id, endpoint: transientEndpoint, p256dh: 'k3', auth: 'a3' },
    ])

    sendNotificationMock.mockImplementation((sub: { endpoint: string }) => {
      if (sub.endpoint === goneEndpoint) {
        return Promise.reject(new FakeWebPushError('gone', 410))
      }
      if (sub.endpoint === transientEndpoint) {
        return Promise.reject(new FakeWebPushError('server error', 500))
      }
      return Promise.resolve({ statusCode: 201 })
    })

    const result = await sendPushToUser(service, user.id, {
      title: 'Hello',
      body: 'World',
      link: '/dashboard',
    })

    expect(result.skipped).toBe(false)
    expect(result.attempted).toBe(3)
    expect(result.sent).toBe(1)
    expect(result.pruned).toBe(1)
    expect(sendNotificationMock).toHaveBeenCalledTimes(3)

    const { data: remaining } = await service
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', user.id)
    const endpoints = (remaining ?? []).map((r) => r.endpoint).sort()
    expect(endpoints).toEqual([goodEndpoint, transientEndpoint].sort())
  })

  it('no-ops with skipped=true when VAPID is not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_SUBJECT

    const user = await createTestUser()
    await waitForProfile(user.id)
    const service = serviceClient()
    await service.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint: `https://push.example/${randomUUID()}`,
      p256dh: 'k',
      auth: 'a',
    })

    const result = await sendPushToUser(service, user.id, { title: 'Hi' })

    expect(result.skipped).toBe(true)
    expect(result.attempted).toBe(0)
    expect(sendNotificationMock).not.toHaveBeenCalled()
  })
})
