'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveBillAction, saveSubscriptionAction, type SaveResult } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

/** Shared recurrence picker — freq + interval, building an RRULE server-side. */
function RecurrenceFields({ pending }: { pending: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label htmlFor="freq" className="block text-sm font-medium text-sage-800">
          Repeats
        </label>
        <select id="freq" name="freq" className={inputClass} disabled={pending} defaultValue="monthly">
          <option value="">Doesn&apos;t repeat</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="interval" className="block text-sm font-medium text-sage-800">
          Every
        </label>
        <input
          id="interval"
          name="interval"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          defaultValue="1"
          className={inputClass}
          disabled={pending}
        />
      </div>
    </div>
  )
}

function useSubmit(action: (fd: FormData) => Promise<SaveResult>) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function handle(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await action(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }
  return { error, pending, handle }
}

export function BillForm({ categories }: { categories: string[] }) {
  const { error, pending, handle } = useSubmit(saveBillAction)
  return (
    <form action={handle} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="bill_name" className="block text-sm font-medium text-sage-800">
            Name
          </label>
          <input id="bill_name" name="name" type="text" required maxLength={80} placeholder="e.g. Rent" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="bill_amount" className="block text-sm font-medium text-sage-800">
            Amount (R)
          </label>
          <input id="bill_amount" name="amount" type="number" inputMode="decimal" step="0.01" min="0" required placeholder="e.g. 12000" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="bill_next_due" className="block text-sm font-medium text-sage-800">
            Next due <span className="text-sage-500">(optional)</span>
          </label>
          <input id="bill_next_due" name="next_due" type="date" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="bill_category" className="block text-sm font-medium text-sage-800">
            Category
          </label>
          <select id="bill_category" name="category" className={inputClass} disabled={pending}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <RecurrenceFields pending={pending} />
      <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
        <input name="auto_pay" type="checkbox" className="size-4 accent-terracotta-500" disabled={pending} />
        Auto-pay is set up for this bill
      </label>
      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Add bill'}
      </Button>
    </form>
  )
}

export function SubscriptionForm({ categories }: { categories: string[] }) {
  const { error, pending, handle } = useSubmit(saveSubscriptionAction)
  return (
    <form action={handle} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="sub_name" className="block text-sm font-medium text-sage-800">
            Name
          </label>
          <input id="sub_name" name="name" type="text" required maxLength={80} placeholder="e.g. Netflix" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="sub_amount" className="block text-sm font-medium text-sage-800">
            Amount (R)
          </label>
          <input id="sub_amount" name="amount" type="number" inputMode="decimal" step="0.01" min="0" required placeholder="e.g. 199" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="sub_next_charge" className="block text-sm font-medium text-sage-800">
            Next charge <span className="text-sage-500">(optional)</span>
          </label>
          <input id="sub_next_charge" name="next_charge" type="date" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="sub_category" className="block text-sm font-medium text-sage-800">
            Category
          </label>
          <select id="sub_category" name="category" className={inputClass} disabled={pending}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="sub_cancel_url" className="block text-sm font-medium text-sage-800">
            Cancel link <span className="text-sage-500">(optional)</span>
          </label>
          <input id="sub_cancel_url" name="cancel_url" type="url" placeholder="https://…" className={inputClass} disabled={pending} />
        </div>
      </div>
      <RecurrenceFields pending={pending} />
      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Add subscription'}
      </Button>
    </form>
  )
}
