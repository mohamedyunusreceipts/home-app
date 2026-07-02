'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * AI "Suggest an outfit" button for the Wardrobe module (spec §9.6).
 * Calls POST /api/ai/suggest with kind 'wardrobe_outfit'. A wardrobe-local copy
 * of the same pattern used elsewhere (no cross-module imports).
 *
 * Degrades gracefully on 429 (monthly cap), 500 AI_NOT_CONFIGURED, and other
 * failures.
 */
export function WardrobeAiSuggest({
  label = 'Suggest an outfit with AI',
  context,
}: {
  label?: string
  /** Serializable context object sent with the suggestion request. */
  context: unknown
}) {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function run() {
    setPending(true)
    setResult(null)
    setMessage(null)
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'wardrobe_outfit', context }),
      })

      if (res.status === 429) {
        setMessage("You've reached this month's AI suggestion limit. Try again next month.")
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string }
        if (body.code === 'AI_NOT_CONFIGURED') {
          setMessage('AI suggestions are not set up yet. You can build an outfit manually in the meantime.')
        } else {
          setMessage('Could not get a suggestion just now. Please try again.')
        }
        return
      }

      const body = (await res.json()) as { result?: string }
      setResult(body.result?.trim() || 'No suggestion came back — try again.')
    } catch {
      setMessage('Could not reach the suggestion service. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={run} disabled={pending}>
        {pending ? 'Thinking…' : label}
      </Button>

      {message && (
        <p className="text-sm text-sage-600" role="status">
          {message}
        </p>
      )}

      {result && (
        <div className="rounded-md border border-sage-200 bg-sage-50 p-3 text-sm whitespace-pre-wrap text-sage-800">
          {result}
        </div>
      )}
    </div>
  )
}
