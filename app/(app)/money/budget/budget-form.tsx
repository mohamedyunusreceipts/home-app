'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveBudgetAction } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

export function BudgetForm({
  month,
  categories,
}: {
  month: string
  categories: string[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await saveBudgetAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="month" value={month} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <label htmlFor="category" className="block text-sm font-medium text-sage-800">
            Category
          </label>
          <select id="category" name="category" required className={inputClass} disabled={pending}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-1">
          <label htmlFor="limit_amount" className="block text-sm font-medium text-sage-800">
            Monthly limit (R)
          </label>
          <input
            id="limit_amount"
            name="limit_amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            placeholder="e.g. 3000"
            className={inputClass}
            disabled={pending}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Saving…' : 'Set limit'}
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
