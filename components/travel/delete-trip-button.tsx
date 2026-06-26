'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { deleteTripAction } from '@/app/(app)/travel/actions'

/** Two-step delete (soft-delete) for a trip, on the edit page. */
export function DeleteTripButton({ tripId }: { tripId: string }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Delete trip
      </Button>
    )
  }

  return (
    <form action={deleteTripAction} className="flex items-center gap-3">
      <input type="hidden" name="id" value={tripId} />
      <p className="text-sm text-sage-700">Delete this trip and all its content?</p>
      <Button type="submit" variant="outline">
        Yes, delete
      </Button>
      <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  )
}
