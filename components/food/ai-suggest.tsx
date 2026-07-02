'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Reusable AI-suggest button for the Food module. Calls POST /api/ai/suggest
 * with a fixed `kind` and a caller-supplied `context`, then renders the text.
 *
 * Degrades gracefully:
 *  - 500 { code: 'AI_NOT_CONFIGURED' } → a calm "AI isn't set up" message.
 *  - 429 → a "monthly limit reached" message.
 *  - any other failure → a generic try-again message.
 */
export function AiSuggest({
  kind,
  label,
  context,
}: {
  kind: string
  label: string
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
        body: JSON.stringify({ kind, context }),
      })

      if (res.status === 429) {
        setMessage("You've reached this month's AI suggestion limit. Try again next month.")
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string }
        if (body.code === 'AI_NOT_CONFIGURED') {
          setMessage('AI suggestions aren’t set up yet. You can add ideas manually in the meantime.')
        } else {
          setMessage('Couldn’t get suggestions just now. Please try again.')
        }
        return
      }

      const body = (await res.json()) as { result?: string }
      setResult(body.result?.trim() || 'No suggestions came back — try again.')
    } catch {
      setMessage('Couldn’t reach the suggestion service. Please try again.')
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
