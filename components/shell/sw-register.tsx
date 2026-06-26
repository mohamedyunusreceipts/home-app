'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker (public/sw.js) once on mount, guarded by feature
 * detection. Render once in the root layout. Renders nothing.
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[sw] registration failed:', err)
    })
  }, [])

  return null
}
