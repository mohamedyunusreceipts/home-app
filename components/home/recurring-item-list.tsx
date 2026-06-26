import { describeRrule } from '@/lib/rrule'
import { describeDue, formatDateTime } from '@/components/home/format'
import { TickOffButton, type TickOffResult } from '@/components/home/tick-off-button'
import type { ChoreRow } from '@/components/home/map'

function safeDescribe(rrule: string | null): string | null {
  if (!rrule) return null
  try {
    return describeRrule(rrule)
  } catch {
    return null
  }
}

/**
 * Renders a list of chores / cleaning tasks (same shape) with the tick-off
 * action. `memberNames` maps user ids to display names for assignee / last-done.
 */
export function RecurringItemList({
  rows,
  completeAction,
  memberNames,
  emptyText,
}: {
  rows: ChoreRow[]
  completeAction: (id: string) => Promise<TickOffResult>
  memberNames: Record<string, string>
  emptyText: string
}) {
  if (rows.length === 0) {
    return <p className="text-sage-600">{emptyText}</p>
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const recurrence = safeDescribe(row.recurrence_rrule)
        const assignee = row.assignee_user_id
          ? (memberNames[row.assignee_user_id] ?? 'Assigned')
          : 'Either of us'
        return (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sage-200 bg-cream-50 px-4 py-3"
          >
            <div className="space-y-0.5">
              <p className="font-medium text-sage-900">{row.name}</p>
              <p className="text-sm text-sage-600">
                {describeDue(row.next_due)} · {assignee}
                {recurrence ? ` · repeats ${recurrence}` : ''}
              </p>
              {row.last_done_at && (
                <p className="text-xs text-sage-500">
                  Last done {formatDateTime(row.last_done_at)}
                  {row.last_done_by ? ` by ${memberNames[row.last_done_by] ?? 'someone'}` : ''}
                </p>
              )}
            </div>
            <TickOffButton id={row.id} action={completeAction} />
          </li>
        )
      })}
    </ul>
  )
}
