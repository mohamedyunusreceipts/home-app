'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatZar } from '@/components/mortgage/format'
import { addStatementAction } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

type SavedState = { redraw: number; drift: number | null }

export function StatementForm({ defaultRate }: { defaultRate: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState<SavedState | null>(null)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    setSaved(null)
    const result = await addStatementAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSaved({ redraw: result.redraw, drift: result.drift })
    // Refresh the server component so the statement list reflects the new row.
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="statement_month"
            className="block text-sm font-medium text-sage-800"
          >
            Statement month
          </label>
          <input
            id="statement_month"
            name="statement_month"
            type="month"
            required
            className={inputClass}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="closing_balance"
            className="block text-sm font-medium text-sage-800"
          >
            Closing balance (R)
          </label>
          <input
            id="closing_balance"
            name="closing_balance"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            placeholder="e.g. 1450000"
            className={inputClass}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="interest_charged"
            className="block text-sm font-medium text-sage-800"
          >
            Interest charged (R)
          </label>
          <input
            id="interest_charged"
            name="interest_charged"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            placeholder="e.g. 13500"
            className={inputClass}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="annual_rate" className="block text-sm font-medium text-sage-800">
            Annual rate (%)
          </label>
          <input
            id="annual_rate"
            name="annual_rate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            defaultValue={defaultRate}
            placeholder="e.g. 11.25"
            className={inputClass}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="total_paid" className="block text-sm font-medium text-sage-800">
            Total paid <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="total_paid"
            name="total_paid"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="e.g. 18000"
            className={inputClass}
            disabled={pending}
          />
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
            placeholder="Anything worth remembering about this month"
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
        <div className="space-y-1 rounded-md border border-sage-200 bg-sage-50 p-3 text-sm text-sage-800">
          <p>
            <span className="font-medium">Statement saved.</span> Available to redraw is
            now <span className="font-medium">{formatZar(saved.redraw)}</span>.
          </p>
          {saved.drift != null && (
            <p className="text-sage-600">
              {saved.drift < 0
                ? `${formatZar(Math.abs(saved.drift))} below the projected balance — running ahead of schedule.`
                : saved.drift > 0
                  ? `${formatZar(saved.drift)} above the projected balance — slightly behind the original schedule.`
                  : 'Right on the projected balance.'}
            </p>
          )}
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Save statement'}
      </Button>
    </form>
  )
}
