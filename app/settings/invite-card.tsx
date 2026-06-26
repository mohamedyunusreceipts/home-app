'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { generateInviteAction } from './actions'

export function InviteCard({
  appOrigin,
  initialToken,
}: {
  appOrigin: string
  initialToken: string | null
}) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  const inviteUrl = token ? `${appOrigin}/join/${token}` : null

  async function handleGenerate() {
    setPending(true)
    setError(null)
    const result = await generateInviteAction()
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setToken(result.token)
    setCopied(false)
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {inviteUrl ? (
        <>
          <p className="text-sm text-sage-700">
            Share this link with your partner. It expires in 24 hours and can only be
            used once.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sm text-sage-900"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="outline" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Button onClick={handleGenerate} disabled={pending} variant="outline">
            {pending ? 'Regenerating…' : 'Regenerate link'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-sage-700">
            Generate a single-use invite link to add your partner to the household.
          </p>
          <Button onClick={handleGenerate} disabled={pending}>
            {pending ? 'Generating…' : 'Generate invite link'}
          </Button>
        </>
      )}
      {error && <p className="text-sm text-terracotta-700">{error}</p>}
    </div>
  )
}
