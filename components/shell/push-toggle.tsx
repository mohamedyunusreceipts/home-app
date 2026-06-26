'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Minimal "enable browser push" button.
 *
 * DEFERRED — PWA polish phase. Web Push subscription requires an active service
 * worker (`navigator.serviceWorker.ready` → `pushManager.subscribe(...)`), and
 * this app does NOT ship a service worker yet. The full client flow is:
 *
 *   1. Register the SW (added in the PWA phase).
 *   2. `const reg = await navigator.serviceWorker.ready`
 *   3. `const sub = await reg.pushManager.subscribe({
 *          userVisibleOnly: true,
 *          applicationServerKey: urlBase64ToUint8Array(
 *            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
 *          ),
 *      })`
 *   4. POST `sub.toJSON()` to `/api/push/subscribe`  (route + lib are READY).
 *   5. To disable: `sub.unsubscribe()` then POST `{ endpoint }` to
 *      `/api/push/unsubscribe`.
 *
 * Until the SW lands, this button only reflects/handles browser permission and
 * explains that delivery is pending. The subscribe API and `lib/notifications/push.ts`
 * are fully built, so wiring step 1–4 is the only remaining work.
 */
export function PushToggle() {
  const [status, setStatus] = useState<string | null>(null)

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  async function handleEnable() {
    if (!supported) {
      setStatus('Push is not supported in this browser.')
      return
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setStatus('Push is not configured on the server yet.')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setStatus('Notification permission was not granted.')
      return
    }
    // TODO(pwa-polish): register the service worker, subscribe via
    // pushManager.subscribe(...), and POST the result to /api/push/subscribe.
    setStatus('Permission granted. Push delivery is wired up in the PWA phase.')
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={handleEnable} disabled={!supported}>
        Enable browser push
      </Button>
      {status && <p className="text-sm text-sage-600">{status}</p>}
    </div>
  )
}
