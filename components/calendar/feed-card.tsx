'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { rotateIcalTokenAction } from '@/app/(app)/calendar/actions'

export function FeedCard({
  initialToken,
  origin,
}: {
  initialToken: string | null
  origin: string
}) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const feedUrl = token ? `${origin.replace(/\/+$/, '')}/api/ical/${token}` : null

  async function rotate() {
    setPending(true)
    setError(null)
    const res = await rotateIcalTokenAction()
    setPending(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setToken(res.token)
    setCopied(false)
  }

  async function copy() {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable (insecure context) — fail quietly.
    }
  }

  return (
    <div className="space-y-3">
      {feedUrl ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-sage-800">Your feed URL</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              readOnly
              value={feedUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full truncate rounded-md border border-sage-300 bg-sage-50 px-3 py-2 text-sm text-sage-700"
            />
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-sage-600">
          No feed link yet. Generate one to subscribe from your calendar app.
        </p>
      )}

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      <Button type="button" onClick={rotate} disabled={pending} size="sm">
        {pending ? 'Working…' : token ? 'Rotate token' : 'Generate feed link'}
      </Button>
      {token && (
        <p className="text-xs text-sage-500">
          Rotating immediately invalidates the previous link. You&apos;ll need to
          re-subscribe with the new URL.
        </p>
      )}
    </div>
  )
}
