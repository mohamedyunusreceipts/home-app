'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export type TickOffResult =
  | { error: string }
  | { success: true; nextDue: string | null }

/**
 * "Done" action for a recurring item (chore / cleaning task / maintenance
 * reminder). Calls the supplied server action, shows a small confirmation toast
 * (design spec §9.3 — "✓ Nice", no push), and refreshes the list. The action is
 * passed in so this one component serves all three entities.
 */
export function TickOffButton({
  id,
  action,
}: {
  id: string
  action: (id: string) => Promise<TickOffResult>
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    setToast(null)
    const result = await action(id)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setToast(
      result.nextDue ? '✓ Nice — next one scheduled' : '✓ Nice — done',
    )
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
        {pending ? 'Saving…' : 'Done'}
      </Button>
      {toast && <span className="text-sm text-sage-600">{toast}</span>}
      {error && (
        <span className="text-sm text-terracotta-700" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
