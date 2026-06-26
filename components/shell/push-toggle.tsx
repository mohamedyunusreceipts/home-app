'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Enable / disable Web Push for the current device.
 *
 * Flow on enable:
 *   1. requestPermission()
 *   2. navigator.serviceWorker.ready  (SW registered by <SwRegister />)
 *   3. pushManager.subscribe({ userVisibleOnly, applicationServerKey })
 *   4. POST subscription.toJSON() → /api/push/subscribe
 * On disable: subscription.unsubscribe() + POST { endpoint } → /api/push/unsubscribe.
 *
 * The /api/push/* routes upsert/delete push_subscriptions rows for the session
 * user; server-side sendPushToUser() then fans out to those rows.
 */

/** Convert a base64url VAPID public key to the Uint8Array applicationServerKey wants. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

type PushState =
  | 'loading'
  | 'unsupported'
  | 'denied'
  | 'subscribed'
  | 'unsubscribed'

export function PushToggle() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  // Reflect the current subscription/permission state on mount. All detection
  // runs inside an async function so setState only fires from a callback (never
  // synchronously in the effect body), keeping the initial render hydration-stable.
  useEffect(() => {
    let cancelled = false
    const detect = async (): Promise<PushState> => {
      if (!supported) return 'unsupported'
      if (Notification.permission === 'denied') return 'denied'
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        return sub ? 'subscribed' : 'unsubscribed'
      } catch {
        return 'unsubscribed'
      }
    }
    detect().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [supported])

  const enable = useCallback(async () => {
    setMessage(null)
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      setMessage('Push is not configured on the server yet.')
      return
    }
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'unsubscribed')
        setMessage('Notification permission was not granted.')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!res.ok) {
        throw new Error(`subscribe failed (${res.status})`)
      }

      setState('subscribed')
      setMessage('Browser push is on for this device.')
    } catch (err) {
      console.error('[push] enable failed:', err)
      setMessage('Could not enable push. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setMessage(null)
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        const { endpoint } = subscription
        await subscription.unsubscribe()
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
      }
      setState('unsubscribed')
      setMessage('Browser push is off for this device.')
    } catch (err) {
      console.error('[push] disable failed:', err)
      setMessage('Could not disable push. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="space-y-3">
      {state === 'unsupported' && (
        <p className="text-sm text-sage-600">
          This browser does not support push notifications.
        </p>
      )}

      {state === 'denied' && (
        <p className="text-sm text-sage-600">
          Notifications are blocked. Enable them for this site in your browser
          settings, then reload.
        </p>
      )}

      {state === 'subscribed' && (
        <Button variant="outline" size="sm" onClick={disable} disabled={busy}>
          {busy ? 'Working…' : 'Disable browser push'}
        </Button>
      )}

      {(state === 'unsubscribed' || state === 'loading') && (
        <Button
          variant="outline"
          size="sm"
          onClick={enable}
          disabled={busy || state === 'loading'}
        >
          {busy ? 'Working…' : 'Enable browser push'}
        </Button>
      )}

      {message && <p className="text-sm text-sage-600">{message}</p>}

      <p className="text-xs text-sage-500">
        On iPhone or iPad, push works only after you add this app to your Home
        Screen (Share &rarr; &ldquo;Add to Home Screen&rdquo;), and requires iOS
        16.4 or later.
      </p>
    </div>
  )
}
