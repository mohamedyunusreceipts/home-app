'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RecurrenceBuilder } from '@/components/home/recurrence-builder'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

type ActionResult = { error: string } | { success: true }

export function MaintenanceForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    setDone(false)
    const result = await action(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setDone(true)
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="item" className="block text-sm font-medium text-sage-800">
          Item
        </label>
        <input
          id="item"
          name="item"
          type="text"
          required
          maxLength={120}
          placeholder="e.g. Service the geyser"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="next_due" className="block text-sm font-medium text-sage-800">
          Next due <span className="text-sage-500">(optional)</span>
        </label>
        <input
          id="next_due"
          name="next_due"
          type="date"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-sage-800">
          Recurrence <span className="text-sage-500">(optional)</span>
        </label>
        <RecurrenceBuilder disabled={pending} />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="block text-sm font-medium text-sage-800">
          Notes <span className="text-sage-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={500}
          placeholder="Anything worth remembering"
          className={inputClass}
          disabled={pending}
        />
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      {done && <p className="text-sm text-sage-600">Added.</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Add reminder'}
      </Button>
    </form>
  )
}
