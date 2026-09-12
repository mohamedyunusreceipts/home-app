import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOCATION } from '@/lib/salaah/compute'
import { QiblaClient, type QiblaLocation } from './qibla-client'

interface LocationRow {
  latitude: number | null
  longitude: number | null
  location_name: string | null
}

export default async function QiblaPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  // Reuse the location the household already set for Salaah, so the Qibla works
  // out of the box. Falls back to the Salaah default (Cape Town).
  const { data: row } = await supabase
    .from('salaah_settings')
    .select('latitude, longitude, location_name')
    .eq('household_id', householdId)
    .maybeSingle<LocationRow>()

  const initial: QiblaLocation =
    row && row.latitude != null && row.longitude != null
      ? {
          latitude: row.latitude,
          longitude: row.longitude,
          locationName: row.location_name ?? DEFAULT_LOCATION.name,
        }
      : {
          latitude: DEFAULT_LOCATION.lat,
          longitude: DEFAULT_LOCATION.lng,
          locationName: DEFAULT_LOCATION.name,
        }

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Qibla" />
        <QiblaClient initial={initial} />
      </div>
    </main>
  )
}
