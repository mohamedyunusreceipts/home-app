'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { addCatalogueItem, removeCatalogueItem, type CatalogueKind } from './actions'

export type CatalogueItem = { id: string; name: string }

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

export function CatalogueSection({
  kind,
  title,
  placeholder,
  items,
}: {
  kind: CatalogueKind
  title: string
  placeholder: string
  items: CatalogueItem[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(formData: FormData) {
    const name = String(formData.get('name') ?? '')
    setPending(true)
    setError(null)
    const result = await addCatalogueItem(kind, name)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function remove(id: string) {
    setError(null)
    const result = await removeCatalogueItem(id)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl text-terracotta-700">{title}</h2>
        <span className="text-sm text-sage-500">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sage-700">Nothing here yet. Add your first below.</p>
      ) : (
        <ul className="divide-y divide-sage-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-sage-900">{item.name}</span>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                title={`Remove ${item.name}`}
                onClick={() => remove(item.id)}
                className="rounded-md px-2 py-0.5 text-lg leading-none text-sage-400 hover:bg-terracotta-50 hover:text-terracotta-600 focus:outline-none focus:ring-2 focus:ring-terracotta-200"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={add} className="flex gap-2 pt-2">
        <input
          type="text"
          name="name"
          required
          placeholder={placeholder}
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
    </section>
  )
}
