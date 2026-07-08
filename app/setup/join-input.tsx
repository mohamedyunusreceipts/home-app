'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/**
 * Extract an invite token from whatever the partner pasted. Accepts either a
 * full join URL (…/join/<token>[?…][#…]) or a bare token. Returns null if there's
 * nothing usable.
 */
export function parseInviteToken(raw: string): string | null {
  const input = raw.trim()
  if (!input) return null

  // Full URL form: pull the segment after "/join/".
  const match = input.match(/\/join\/([^/?#\s]+)/i)
  if (match?.[1]) return decodeURIComponent(match[1])

  // If it still looks like a URL but without a /join/ segment, we can't use it.
  if (/^https?:\/\//i.test(input) || input.includes('/')) return null

  // Otherwise treat the whole thing as a bare token.
  return input
}

/**
 * "Joining your partner?" input on /setup. Paste an invite link or code, and we
 * route to the existing /join/<token> accept flow.
 */
export function JoinInput() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const token = parseInviteToken(value)
    if (!token) {
      setError("That doesn't look like an invite link or code. Ask your partner to resend it.")
      return
    }
    setError(null)
    router.push(`/join/${encodeURIComponent(token)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste invite link or code"
        aria-label="Invite link or code"
        className="h-11 w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200"
      />
      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full">
        Join household
      </Button>
    </form>
  )
}
