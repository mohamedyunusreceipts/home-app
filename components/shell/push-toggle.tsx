'use client'

import { useCallback, useEffect, useState } from 'react'
import { useShell } from './shell-context'

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
  const { showToast } = useShell()

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
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      showToast('Push is not configured yet.')
      return
    }
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'unsubscribed')
        showToast('Notification permission was not granted.')
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
      showToast('Browser push is on for this device.')
    } catch (err) {
      console.error('[push] enable failed:', err)
      showToast('Could not enable push. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [showToast])

  const disable = useCallback(async () => {
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
      showToast('Browser push is off for this device.')
    } catch (err) {
      console.error('[push] disable failed:', err)
      showToast('Could not disable push. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [showToast])

  // A controllable hardware-style switch matching the redesign: on = #7A9B7A
  // track / knob right, off = #DBCFB7 track / knob left. Unsupported & denied
  // states render a disabled-off switch; feedback is surfaced via the shell toast.
  const isOn = state === 'subscribed'
  const interactive = state === 'subscribed' || state === 'unsubscribed'
  const toggle = isOn ? disable : enable

  return (
    <Switch
      checked={isOn}
      busy={busy || state === 'loading'}
      disabled={!interactive}
      onToggle={toggle}
    />
  )
}

/**
 * The on/off track used by the Push notifications row. Kept inside this module
 * so it stays paired with the push logic above (it has no other consumer yet).
 */
function Switch({
  checked,
  busy,
  disabled,
  onToggle,
}: {
  checked: boolean
  busy: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Push notifications"
      disabled={disabled || busy}
      onClick={onToggle}
      className="relative inline-flex h-[30px] w-[52px] shrink-0 items-center rounded-full px-[3px] transition-colors disabled:opacity-60"
      style={{ backgroundColor: checked ? '#7A9B7A' : '#DBCFB7' }}
    >
      <span
        className="h-[24px] w-[24px] rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(0)' }}
      />
    </button>
  )
}
