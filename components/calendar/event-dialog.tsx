'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { saveEventAction } from '@/app/(app)/calendar/actions'
import type { CalendarEventRow } from './types'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

// SAST (UTC+2) wall-clock value for a datetime-local / date input.
const sastDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Johannesburg',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const sastTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Johannesburg',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return sastDateFmt.format(d)
}
function toDateTimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${sastDateFmt.format(d)}T${sastTimeFmt.format(d)}`
}

interface EventDialogProps {
  /** When set, the manual event being edited (its source_id is the calendar_events id). */
  row: CalendarEventRow | null
  onClose: () => void
  onSaved: () => void
}

export function EventDialog({ row, onClose, onSaved }: EventDialogProps) {
  const isEdit = row != null
  const [allDay, setAllDay] = useState<boolean>(row?.all_day ?? false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const res = await saveEventAction(formData)
    setPending(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-card p-5 ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 font-serif text-lg text-terracotta-700">
          {isEdit ? 'Edit event' : 'New event'}
        </h3>

        <form action={handleSubmit} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={row!.source_id} />}

          <div className="space-y-2">
            <label htmlFor="ev-title" className="block text-sm font-medium text-sage-800">
              Title
            </label>
            <input
              id="ev-title"
              name="title"
              type="text"
              required
              defaultValue={row?.title ?? ''}
              placeholder="e.g. Dinner with friends"
              className={inputClass}
              disabled={pending}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-sage-800">
            <input
              type="checkbox"
              name="all_day"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              disabled={pending}
            />
            All-day
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="ev-start" className="block text-sm font-medium text-sage-800">
                Start
              </label>
              <input
                id="ev-start"
                name="start"
                type={allDay ? 'date' : 'datetime-local'}
                required
                defaultValue={allDay ? toDateInput(row?.start ?? null) : toDateTimeInput(row?.start ?? null)}
                className={inputClass}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ev-end" className="block text-sm font-medium text-sage-800">
                End <span className="text-sage-500">(optional)</span>
              </label>
              <input
                id="ev-end"
                name="end"
                type={allDay ? 'date' : 'datetime-local'}
                defaultValue={allDay ? toDateInput(row?.end ?? null) : toDateTimeInput(row?.end ?? null)}
                className={inputClass}
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="ev-location" className="block text-sm font-medium text-sage-800">
              Location <span className="text-sage-500">(optional)</span>
            </label>
            <input
              id="ev-location"
              name="location"
              type="text"
              className={inputClass}
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ev-notes" className="block text-sm font-medium text-sage-800">
              Notes <span className="text-sage-500">(optional)</span>
            </label>
            <textarea
              id="ev-notes"
              name="notes"
              rows={2}
              className={inputClass}
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ev-color" className="block text-sm font-medium text-sage-800">
              Colour <span className="text-sage-500">(optional)</span>
            </label>
            <input
              id="ev-color"
              name="color"
              type="color"
              defaultValue="#14b8a6"
              className="h-9 w-16 cursor-pointer rounded-md border border-sage-300 bg-cream-50"
              disabled={pending}
            />
          </div>

          {error && (
            <p className="text-sm text-terracotta-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
