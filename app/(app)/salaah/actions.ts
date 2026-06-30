'use server'

import { revalidatePath } from 'next/cache'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { METHODS, MADHABS, NOTIFIABLE_PRAYERS } from '@/lib/salaah/compute'

export type ActionResult = { error: string } | { success: true }

export interface SaveSalaahInput {
  latitude: number
  longitude: number
  locationName: string
  timezone: string
  method: string
  madhab: string
  pushEnabled: boolean
  prayers: Record<string, boolean>
}

/**
 * Upsert the calling household's salaah settings. household_id is taken from the
 * session (never trusted from the client). Validates the numeric coordinates and
 * that method/madhab are members of the known sets.
 */
export async function saveSalaahSettings(input: SaveSalaahInput): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { latitude, longitude } = input
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { error: 'Please choose a valid location.' }
  }

  if (!(input.method in METHODS)) {
    return { error: 'Unknown calculation method.' }
  }
  if (!(input.madhab in MADHABS)) {
    return { error: 'Unknown madhab.' }
  }

  // Normalise the prayers map to exactly the five notifiable prayers as booleans.
  const prayers: Record<string, boolean> = {}
  for (const p of NOTIFIABLE_PRAYERS) {
    prayers[p] = input.prayers?.[p] !== false
  }

  const locationName = input.locationName.trim() || 'My location'
  const timezone = input.timezone.trim() || 'Africa/Johannesburg'

  const { error } = await supabase.from('salaah_settings').upsert(
    {
      household_id: householdId,
      latitude,
      longitude,
      location_name: locationName,
      timezone,
      method: input.method,
      madhab: input.madhab,
      push_enabled: input.pushEnabled,
      prayers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'household_id' },
  )

  if (error) {
    return { error: `Could not save your settings: ${error.message}` }
  }

  revalidatePath('/salaah')
  return { success: true }
}
