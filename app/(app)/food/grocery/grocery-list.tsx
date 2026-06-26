'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatQty } from '@/components/food/format'
import type { GroceryItemRow } from '@/components/food/types'
import {
  addGroceryItemAction,
  toggleGroceryItemAction,
  clearCheckedAction,
} from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

const SOURCE_LABEL: Record<GroceryItemRow['source'], string> = {
  manual: 'added by hand',
  meal_plan: 'from meal plan',
  recipe: 'from a recipe',
}

export function GroceryList({ items }: { items: GroceryItemRow[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await addGroceryItemAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function toggle(id: string, checked: boolean) {
    await toggleGroceryItemAction(id, checked)
    router.refresh()
  }

  async function clearChecked() {
    await clearCheckedAction()
    router.refresh()
  }

  const hasChecked = items.some((i) => i.checked)

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sage-700">
          Your list is empty. Add items below, or build it from this week&apos;s meals on the
          Meal plan tab.
        </p>
      ) : (
        <ul className="divide-y divide-sage-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={item.checked}
                aria-label={`Mark ${item.name} as bought`}
                className="size-4 accent-terracotta-400"
                onChange={(e) => toggle(item.id, e.target.checked)}
              />
              <span
                className={
                  item.checked ? 'flex-1 text-sage-400 line-through' : 'flex-1 text-sage-900'
                }
              >
                {item.name}
                {formatQty(item.qty, item.unit) && (
                  <span className="text-sage-500"> · {formatQty(item.qty, item.unit)}</span>
                )}
              </span>
              <span className="text-xs text-sage-400">{SOURCE_LABEL[item.source]}</span>
            </li>
          ))}
        </ul>
      )}

      {hasChecked && (
        <Button type="button" variant="outline" size="sm" onClick={clearChecked}>
          Clear bought items
        </Button>
      )}

      <form action={add} className="grid grid-cols-[1fr_80px_80px_auto] gap-2 pt-2">
        <input
          type="text"
          name="name"
          required
          placeholder="Add an item"
          className={inputClass}
          disabled={pending}
        />
        <input
          type="number"
          name="qty"
          step="0.001"
          min="0"
          placeholder="Qty"
          className={inputClass}
          disabled={pending}
        />
        <input
          type="text"
          name="unit"
          placeholder="Unit"
          className={inputClass}
          disabled={pending}
        />
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
