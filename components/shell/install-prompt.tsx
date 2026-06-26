'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Unobtrusive "Install Home" affordance for the PWA.
 *
 *   - Chrome / Android: captures the `beforeinstallprompt` event, stashes the
 *     deferred prompt, and shows a small button that calls `prompt()` on click.
 *   - iOS Safari (which never fires `beforeinstallprompt`): shows a one-line
 *     hint to use Share → "Add to Home Screen".
 *   - Already installed (standalone display mode): renders nothing.
 *
 * Dismissal is persisted in localStorage so we don't nag on every visit. All
 * environment detection runs in effects (never in the render body) so the first
 * client render matches the server render and stays hydration-stable.
 */

const DISMISS_KEY = 'home:install-prompt-dismissed'

/** The `beforeinstallprompt` event isn't in the standard DOM lib types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Mode = 'hidden' | 'installable' | 'ios-hint'

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPhone/iPad/iPod, plus iPadOS 13+ which reports as desktop Safari but is
  // touch-capable on a Mac-like UA.
  const iosLike = /iphone|ipad|ipod/i.test(ua)
  const iPadOs = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  return iosLike || iPadOs
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mql = window.matchMedia('(display-mode: standalone)').matches
  // iOS Safari exposes navigator.standalone instead of the display-mode query.
  const iosStandalone =
    'standalone' in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return mql || iosStandalone
}

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>('hidden')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Respect a prior dismissal and an existing install.
    if (isStandalone()) return
    let dismissed = false
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      dismissed = false
    }
    if (dismissed) return

    const onBeforeInstall = (event: Event) => {
      // Stop Chrome's mini-infobar; we surface our own button instead.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setMode('installable')
    }

    const onInstalled = () => {
      setDeferred(null)
      setMode('hidden')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS never fires beforeinstallprompt — fall back to the manual hint.
    // Deferred to a microtask so setState isn't called synchronously in the effect body.
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled && isIos()) setMode('ios-hint')
    })

    return () => {
      cancelled = true
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = useCallback(() => {
    setMode('hidden')
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Ignore storage failures (private mode, etc.).
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      await deferred.userChoice
    } catch {
      // Swallow — the prompt can only be used once and may already be consumed.
    } finally {
      setDeferred(null)
      setMode('hidden')
    }
  }, [deferred])

  if (mode === 'hidden') return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Install app"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-sage-300 bg-cream-50 px-4 py-3 shadow-md">
        {mode === 'installable' ? (
          <>
            <p className="flex-1 text-sm text-sage-800">
              Add Home to your device for a faster, full-screen experience.
            </p>
            <Button size="sm" onClick={install}>
              Install Home
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={dismiss}
              aria-label="Dismiss install prompt"
            >
              &times;
            </Button>
          </>
        ) : (
          <>
            <p className="flex-1 text-sm text-sage-800">
              Install Home: tap Share, then &ldquo;Add to Home Screen&rdquo;.
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={dismiss}
              aria-label="Dismiss install hint"
            >
              &times;
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
