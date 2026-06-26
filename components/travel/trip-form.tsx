'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { TRIP_STATUSES, TRIP_STATUS_LABELS, type TripRow } from '@/components/travel/map'
import { upsertTripAction } from '@/app/(app)/travel/actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

/**
 * Create or edit a trip. When `trip` is supplied the form edits in place and
 * navigates to the trip detail on save; otherwise it creates and routes to the
 * new trip.
 */
export function TripForm({ trip }: { trip?: TripRow }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await upsertTripAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push(`/travel/${result.tripId}`)
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {trip && <input type="hidden" name="id" value={trip.id} />}

      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-sage-800">
          Trip name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={trip?.name ?? ''}
          placeholder="e.g. Honeymoon in Lisbon"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="destination" className="block text-sm font-medium text-sage-800">
          Destination <span className="text-sage-500">(optional)</span>
        </label>
        <input
          id="destination"
          name="destination"
          type="text"
          maxLength={120}
          defaultValue={trip?.destination ?? ''}
          placeholder="e.g. Lisbon, Portugal"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="start_date" className="block text-sm font-medium text-sage-800">
            Start date <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={trip?.start_date ?? ''}
            className={inputClass}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="end_date" className="block text-sm font-medium text-sage-800">
            End date <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={trip?.end_date ?? ''}
            className={inputClass}
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="status" className="block text-sm font-medium text-sage-800">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={trip?.status ?? 'idea'}
            className={inputClass}
            disabled={pending}
          >
            {TRIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TRIP_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="budget_total" className="block text-sm font-medium text-sage-800">
            Budget (R) <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="budget_total"
            name="budget_total"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            defaultValue={trip?.budget_total ?? ''}
            placeholder="e.g. 40000"
            className={inputClass}
            disabled={pending}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : trip ? 'Save trip' : 'Create trip'}
      </Button>
    </form>
  )
}
