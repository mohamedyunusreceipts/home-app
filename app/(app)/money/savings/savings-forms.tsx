'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createGoalAction, adjustGoalAction } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

export function NewGoalForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await createGoalAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-sage-800">
            Goal name
          </label>
          <input id="name" name="name" type="text" required maxLength={80} placeholder="e.g. Holiday fund" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="target" className="block text-sm font-medium text-sage-800">
            Target (R)
          </label>
          <input id="target" name="target" type="number" inputMode="decimal" step="0.01" min="0" required placeholder="e.g. 20000" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="current" className="block text-sm font-medium text-sage-800">
            Saved so far (R)
          </label>
          <input id="current" name="current" type="number" inputMode="decimal" step="0.01" min="0" defaultValue="0" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="deadline" className="block text-sm font-medium text-sage-800">
            Deadline <span className="text-sage-500">(optional)</span>
          </label>
          <input id="deadline" name="deadline" type="date" className={inputClass} disabled={pending} />
        </div>
      </div>
      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Create goal'}
      </Button>
    </form>
  )
}

/** Inline "add to / take from" control on each goal card. */
export function AdjustGoal({ goalId }: { goalId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await adjustGoalAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <form action={submit} className="flex items-center gap-2">
      <input type="hidden" name="goal_id" value={goalId} />
      <input
        name="delta"
        type="number"
        inputMode="decimal"
        step="0.01"
        placeholder="+/- amount"
        className={`${inputClass} max-w-[10rem]`}
        disabled={pending}
        required
      />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? '…' : 'Update'}
      </Button>
      {error && (
        <span className="text-xs text-terracotta-700" role="alert">
          {error}
        </span>
      )}
    </form>
  )
}
