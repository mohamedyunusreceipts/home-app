'use client'

import { useEffect, useState } from 'react'
import { useShell } from '@/components/shell/shell-context'
import { createClient } from '@/lib/supabase/client'
import { disconnectDriveAction } from './actions'

/**
 * Google Drive connect card for the Focus Timeline Settings screen.
 *
 * Not connected (owner): explains the feature + a "Connect Google Drive" button
 * that kicks off Supabase Google OAuth requesting the `drive.file` scope offline,
 * redirecting to /auth/drive-callback (which stores the encrypted refresh token
 * and ensures the /HomeApp root folder — see actions + the route handler).
 *
 * Not connected (partner): a note that Drive is owner-managed.
 *
 * Connected: a confirmation line + an optional disconnect that clears the columns.
 *
 * The flow is gated on Google config (Drive API + scope on the consent screen,
 * the scope on the Supabase Google provider, and DRIVE_TOKEN_ENCRYPTION_KEY);
 * until then the callback redirects back with ?drive=error and we surface a toast.
 */
export function DriveCard({
  connected,
  isOwner,
}: {
  connected: boolean
  isOwner: boolean
}) {
  const { showToast } = useShell()
  const [busy, setBusy] = useState(false)

  // Surface the callback result (?drive=connected|error) as a toast once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('drive')
    if (status === 'connected') {
      showToast('Google Drive connected')
    } else if (status === 'error') {
      showToast('Could not connect Google Drive')
    }
    if (status) {
      // Clean the URL so the toast doesn't re-fire on refresh/navigation.
      params.delete('drive')
      const qs = params.toString()
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (qs ? `?${qs}` : ''),
      )
    }
  }, [showToast])

  async function handleConnect() {
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/drive.file',
          queryParams: { access_type: 'offline', prompt: 'consent' },
          redirectTo: `${window.location.origin}/auth/drive-callback`,
        },
      })
      if (error) {
        showToast('Could not start Google sign-in')
        setBusy(false)
      }
      // On success the browser is redirected to Google; no further work here.
    } catch {
      showToast('Could not start Google sign-in')
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    setBusy(true)
    try {
      const result = await disconnectDriveAction()
      if (result && 'error' in result) {
        showToast('Could not disconnect Drive')
      } else {
        showToast('Google Drive disconnected')
      }
    } catch {
      showToast('Could not disconnect Drive')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[20px] border border-[#E8DFCE] bg-[#FFFDF9] p-[18px]">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#FBF2EE] text-[#C77B5C]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
            <path d="M14 2v6h6" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#3F2118]">Google Drive</p>
          <p className="text-[13px] text-[#8a7163]">
            {connected
              ? 'Connected · files stored in your Drive under /HomeApp'
              : 'Store your documents and photos in your own Google Drive.'}
          </p>
        </div>
      </div>

      {connected ? (
        isOwner ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busy}
            className="mt-4 w-full rounded-[14px] border border-[#E8DFCE] bg-transparent px-4 py-2.5 text-[13px] font-semibold text-[#8a7163] transition-colors hover:bg-[#F2EBDF] disabled:opacity-50"
          >
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : null
      ) : isOwner ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy}
          className="mt-4 w-full rounded-[14px] bg-[#C77B5C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Connect Google Drive'}
        </button>
      ) : (
        <p className="mt-4 rounded-[14px] bg-[#F1F5F1] px-4 py-2.5 text-[13px] text-[#5F8160]">
          Drive is managed by the household owner.
        </p>
      )}
    </section>
  )
}
