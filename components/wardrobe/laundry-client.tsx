'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { LaundryButtons } from './laundry-buttons'
import { CATEGORY_LABELS, LAUNDRY_LABELS } from './format'
import type { WardrobeItemRow } from './types'

const SECTIONS: { status: 'clean' | 'worn' | 'in_wash'; blurb: string }[] = [
  { status: 'worn', blurb: 'Worn since last wash — send these to the wash when ready.' },
  { status: 'in_wash', blurb: 'In the wash — mark wash done when they are clean again.' },
  { status: 'clean', blurb: 'Clean and ready to wear.' },
]

/**
 * Laundry-aware view with bulk selection. Tick items, then apply a transition to
 * all of them at once. Single-item transitions are also available per row.
 */
export function LaundryClient({ items }: { items: WardrobeItemRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedIds = [...selected]

  return (
    <div className="space-y-6">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-terracotta-200 bg-cream-50 p-3">
          <span className="text-sm font-medium text-sage-800">
            {selectedIds.length} selected
          </span>
          <LaundryButtons ids={selectedIds} />
        </div>
      )}

      {SECTIONS.map(({ status, blurb }) => {
        const rows = items.filter((i) => i.laundry_status === status)
        return (
          <section key={status} className="space-y-3">
            <div>
              <h2 className="font-serif text-xl text-terracotta-700">
                {LAUNDRY_LABELS[status]} ({rows.length})
              </h2>
              <p className="text-sm text-sage-600">{blurb}</p>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-sage-500">Nothing here.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="space-y-2 p-4">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                          className="mt-1 size-4 accent-terracotta-500"
                        />
                        <span>
                          <span className="font-medium text-sage-900">
                            {CATEGORY_LABELS[item.category] ?? item.category}
                            {item.color ? ` · ${item.color}` : ''}
                          </span>
                          {item.brand && (
                            <span className="block text-sm text-sage-600">{item.brand}</span>
                          )}
                        </span>
                      </label>
                      <LaundryButtons ids={[item.id]} status={item.laundry_status} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
