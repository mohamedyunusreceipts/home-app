'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RecurrenceBuilder } from '@/components/home/recurrence-builder'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

type ActionResult = { error: string } | { success: true }

export type Member = { id: string; label: string }

/**
 * Create form for a chore or cleaning task (same columns). Mirrors the mortgage
 * statement-form pending/error pattern. Includes the recurrence builder and an
 * optional assignee + first due date.
 */
export function RecurringItemForm({
  action,
  nounLabel,
  members,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  nounLabel: string
  members: Member[]
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
        <label htmlFor="name" className="block text-sm font-medium text-sage-800">
          {nounLabel} name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder={`e.g. ${nounLabel === 'Chore' ? 'Take out the bins' : 'Vacuum the lounge'}`}
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="assignee_user_id"
            className="block text-sm font-medium text-sage-800"
          >
            Assigned to <span className="text-sage-500">(optional)</span>
          </label>
          <select
            id="assignee_user_id"
            name="assignee_user_id"
            className={inputClass}
            disabled={pending}
            defaultValue=""
          >
            <option value="">Either of us</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="next_due" className="block text-sm font-medium text-sage-800">
            First due <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="next_due"
            name="next_due"
            type="date"
            className={inputClass}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-sage-800">
          Recurrence <span className="text-sage-500">(optional)</span>
        </label>
        <RecurrenceBuilder disabled={pending} />
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      {done && <p className="text-sm text-sage-600">Added.</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : `Add ${nounLabel.toLowerCase()}`}
      </Button>
    </form>
  )
}
