'use client'

import { useTransition } from 'react'
import { setLaundryStatusAction } from '@/app/(app)/wardrobe/actions'
import type { LaundryStatus } from './types'

/**
 * Contextual laundry transitions for one or more items (bulk-capable via `ids`).
 * Shows only the transitions that make sense from the current status:
 *   clean   → "Mark worn", "Send to wash"
 *   worn    → "Send to wash", "Mark clean"
 *   in_wash → "Wash done"
 * For a bulk selection (mixed statuses) all three actions are offered.
 */
export function LaundryButtons({
  ids,
  status,
}: {
  ids: string[]
  /** Single-item status, or undefined for a mixed/bulk selection. */
  status?: LaundryStatus
}) {
  const [pending, startTransition] = useTransition()

  function submit(next: LaundryStatus) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('status', next)
      ids.forEach((id) => fd.append('ids', id))
      await setLaundryStatusAction(fd)
    })
  }

  const show = {
    worn: status === undefined || status === 'clean',
    in_wash: status === undefined || status === 'clean' || status === 'worn',
    clean: status === undefined || status === 'worn' || status === 'in_wash',
  }

  const btn =
    'rounded-full border border-sage-300 px-2 py-0.5 text-xs font-medium text-sage-700 hover:bg-sage-100 disabled:opacity-50'

  return (
    <span className="inline-flex flex-wrap gap-1">
      {show.worn && (
        <button type="button" className={btn} disabled={pending || ids.length === 0} onClick={() => submit('worn')}>
          Mark worn
        </button>
      )}
      {show.in_wash && (
        <button type="button" className={btn} disabled={pending || ids.length === 0} onClick={() => submit('in_wash')}>
          Send to wash
        </button>
      )}
      {show.clean && (
        <button type="button" className={btn} disabled={pending || ids.length === 0} onClick={() => submit('clean')}>
          {status === 'in_wash' ? 'Wash done' : 'Mark clean'}
        </button>
      )}
    </span>
  )
}
