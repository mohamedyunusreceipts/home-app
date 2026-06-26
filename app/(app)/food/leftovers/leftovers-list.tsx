'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatDate, expiryLabel, daysUntil } from '@/components/food/format'
import type { LeftoverRow, RecipeRow } from '@/components/food/types'
import { addLeftoverAction, removeLeftoverAction } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

export function LeftoversList({
  items,
  recipes,
}: {
  items: LeftoverRow[]
  recipes: Pick<RecipeRow, 'id' | 'name'>[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await addLeftoverAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function remove(id: string) {
    await removeLeftoverAction(id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sage-700">No leftovers tracked. Add one below so nothing goes to waste.</p>
      ) : (
        <ul className="divide-y divide-sage-100">
          {items.map((item) => {
            const days = daysUntil(item.consume_by)
            const soon = Number.isFinite(days) && days <= 2
            return (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sage-900">{item.name}</span>
                <span
                  className={soon ? 'text-xs font-medium text-terracotta-700' : 'text-xs text-sage-500'}
                  title={formatDate(item.consume_by)}
                >
                  {expiryLabel(item.consume_by)}
                </span>
                <Button type="button" variant="ghost" size="xs" onClick={() => remove(item.id)}>
                  Done
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <form action={add} className="grid gap-2 pt-2 sm:grid-cols-[1fr_150px_1fr_auto]">
        <input type="text" name="name" required placeholder="Leftover" className={inputClass} disabled={pending} />
        <input type="date" name="consume_by" required aria-label="Consume by" className={inputClass} disabled={pending} />
        <select name="from_recipe_id" aria-label="From recipe" className={inputClass} disabled={pending} defaultValue="">
          <option value="">— from recipe (optional) —</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
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
