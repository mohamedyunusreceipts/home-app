'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { addTransactionAction } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

/** A household member offered as a contributor option. */
export type ContributorOption = { userId: string; name: string }

export function TransactionForm({ members }: { members: ContributorOption[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    setSaved(false)
    const result = await addTransactionAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSaved(true)
    // Refresh the server component so the history + totals reflect the new row.
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="kind" className="block text-sm font-medium text-sage-800">
            Type
          </label>
          <select id="kind" name="kind" required className={inputClass} disabled={pending}>
            <option value="extra_deposit">Extra deposit (money in)</option>
            <option value="withdrawal">Withdrawal (money out)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="amount" className="block text-sm font-medium text-sage-800">
            Amount (R)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            placeholder="e.g. 5000"
            className={inputClass}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="occurred_on" className="block text-sm font-medium text-sage-800">
            Date
          </label>
          <input
            id="occurred_on"
            name="occurred_on"
            type="date"
            required
            className={inputClass}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="contributed_by_user_id"
            className="block text-sm font-medium text-sage-800"
          >
            Contributed by
          </label>
          <select
            id="contributed_by_user_id"
            name="contributed_by_user_id"
            className={inputClass}
            disabled={pending}
            defaultValue=""
          >
            <option value="">Joint</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="note" className="block text-sm font-medium text-sage-800">
            Note <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="note"
            name="note"
            type="text"
            maxLength={200}
            placeholder="What was this for?"
            className={inputClass}
            disabled={pending}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      {saved && (
        <p className="rounded-md border border-sage-200 bg-sage-50 p-3 text-sm text-sage-800">
          <span className="font-medium">Logged.</span> Your contribution history has been
          updated.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Log it'}
      </Button>
    </form>
  )
}
