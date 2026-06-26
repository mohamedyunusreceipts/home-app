import webpush, { WebPushError } from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Web Push delivery via the `web-push` library.
 *
 * VAPID config is read from the environment AT CALL TIME (not at module load),
 * so the same module works in tests that set keys per-suite and in serverless
 * cold starts where env is injected late:
 *   - VAPID_PUBLIC_KEY
 *   - VAPID_PRIVATE_KEY
 *   - VAPID_SUBJECT      (e.g. "mailto:you@example.com")
 *
 * CLIENT NOTE: to subscribe in the browser you also need the public key on the
 * client. Expose it as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and read it client-side
 * via `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY`. It must equal VAPID_PUBLIC_KEY.
 *
 * Behaviour when unconfigured: `sendPushToUser` is a NO-OP and logs a warning
 * (it does not throw). This keeps notification creation working in dev/CI where
 * push is not set up — the in-app notification still lands; only the push fan-out
 * is skipped.
 */

export interface PushPayload {
  title: string
  body?: string
  link?: string
  /** Optional notification tag for client-side de-duplication. */
  tag?: string
}

interface SubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

/** Read + validate VAPID config from env. Returns null if not fully configured. */
function readVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export interface SendPushResult {
  /** Total subscriptions attempted. */
  attempted: number
  /** Successfully delivered. */
  sent: number
  /** Endpoints pruned because the push service reported them gone (404/410). */
  pruned: number
  /** True when VAPID was not configured and the whole call was skipped. */
  skipped: boolean
}

/**
 * Send `payload` to every push subscription belonging to `userId`, pruning any
 * subscription the push service reports as gone (HTTP 404 / 410).
 *
 * `supabase` must be authorised to read/delete the target user's
 * `push_subscriptions` rows (the user's own session, or a service-role client
 * for server-side fan-out).
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<SendPushResult> {
  const vapid = readVapidConfig()
  if (!vapid) {
    console.warn(
      '[push] VAPID not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT); skipping push send.',
    )
    return { attempted: 0, sent: 0, pruned: 0, skipped: true }
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .returns<SubscriptionRow[]>()

  if (error) {
    throw new Error(`sendPushToUser: failed to load subscriptions: ${error.message}`)
  }

  const subs = subscriptions ?? []
  const serialized = JSON.stringify(payload)
  const deadIds: string[] = []
  let sent = 0

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          serialized,
        )
        sent += 1
      } catch (err) {
        // 404 / 410 → subscription is permanently gone; prune it.
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          deadIds.push(sub.id)
        } else {
          // Transient failure (network, 5xx, etc.) — log and move on; keep the sub.
          console.warn(
            `[push] send failed for subscription ${sub.id}:`,
            err instanceof Error ? err.message : String(err),
          )
        }
      }
    }),
  )

  if (deadIds.length > 0) {
    const { error: delError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', deadIds)
    if (delError) {
      console.warn(`[push] failed to prune dead subscriptions: ${delError.message}`)
    }
  }

  return {
    attempted: subs.length,
    sent,
    pruned: deadIds.length,
    skipped: false,
  }
}
