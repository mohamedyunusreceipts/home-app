'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SharedListItem } from '@/components/home/map'

type ActionResult = { error: string } | { success: true }

/**
 * Renders one shared list with tappable checkbox items. Toggling an item calls
 * the server action with the list id + item index; the jsonb array is updated
 * server-side and the page revalidated.
 */
export function SharedListCard({
  id,
  name,
  items,
  toggleAction,
}: {
  id: string
  name: string
  items: SharedListItem[]
  toggleAction: (listId: string, index: number) => Promise<ActionResult>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(index: number) {
    setError(null)
    startTransition(async () => {
      const result = await toggleAction(id, index)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-terracotta-700">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sage-600">This list is empty.</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item, index) => (
              <li key={index}>
                <label className="flex cursor-pointer items-center gap-2 text-sage-800">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggle(index)}
                    disabled={isPending}
                    className="size-4 accent-terracotta-400"
                  />
                  <span className={item.checked ? 'text-sage-400 line-through' : ''}>
                    {item.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="text-sm text-terracotta-700" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
