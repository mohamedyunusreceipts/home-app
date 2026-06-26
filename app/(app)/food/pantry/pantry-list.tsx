'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatQty, formatDate, expiryLabel, daysUntil } from '@/components/food/format'
import type { PantryItemRow } from '@/components/food/types'
import { addPantryItemAction, removePantryItemAction } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

export function PantryList({ items }: { items: PantryItemRow[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await addPantryItemAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function remove(id: string) {
    await removePantryItemAction(id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sage-700">Your pantry is empty. Add what you have on hand below.</p>
      ) : (
        <ul className="divide-y divide-sage-100">
          {items.map((item) => {
            const days = item.expires_on ? daysUntil(item.expires_on) : Number.POSITIVE_INFINITY
            const soon = Number.isFinite(days) && days <= 3
            return (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sage-900">
                  {item.name}
                  {formatQty(item.qty, item.unit) && (
                    <span className="text-sage-500"> · {formatQty(item.qty, item.unit)}</span>
                  )}
                </span>
                {item.expires_on && (
                  <span
                    className={soon ? 'text-xs font-medium text-terracotta-700' : 'text-xs text-sage-500'}
                    title={formatDate(item.expires_on)}
                  >
                    {expiryLabel(item.expires_on)}
                  </span>
                )}
                <Button type="button" variant="ghost" size="xs" onClick={() => remove(item.id)}>
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <form action={add} className="grid grid-cols-[1fr_70px_70px_140px_auto] gap-2 pt-2">
        <input type="text" name="name" required placeholder="Item" className={inputClass} disabled={pending} />
        <input type="number" name="qty" step="0.001" min="0" placeholder="Qty" className={inputClass} disabled={pending} />
        <input type="text" name="unit" placeholder="Unit" className={inputClass} disabled={pending} />
        <input type="date" name="expires_on" aria-label="Expires on" className={inputClass} disabled={pending} />
        <Button type="submit" disabled={pending}>
          Add
        </Button>
      </form>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
