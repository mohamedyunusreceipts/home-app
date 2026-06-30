import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { SalaahClient, type SalaahSettings } from './salaah-client'
import {
  DEFAULT_LOCATION,
  DEFAULT_METHOD,
  DEFAULT_MADHAB,
} from '@/lib/salaah/compute'

interface SalaahSettingsRow {
  household_id: string
  latitude: number | null
  longitude: number | null
  location_name: string | null
  timezone: string | null
  method: string
  madhab: string
  push_enabled: boolean
  prayers: Record<string, boolean> | null
}

export default async function SalaahPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('salaah_settings')
    .select(
      'household_id, latitude, longitude, location_name, timezone, method, madhab, push_enabled, prayers',
    )
    .eq('household_id', householdId)
    .maybeSingle<SalaahSettingsRow>()

  // No saved settings yet → default to Cape Town with sensible method/madhab.
  const initial: SalaahSettings =
    row && row.latitude != null && row.longitude != null
      ? {
          latitude: row.latitude,
          longitude: row.longitude,
          locationName: row.location_name ?? DEFAULT_LOCATION.name,
          timezone: row.timezone ?? DEFAULT_LOCATION.timezone,
          method: row.method,
          madhab: row.madhab,
          pushEnabled: row.push_enabled,
          prayers: {
            fajr: row.prayers?.fajr !== false,
            dhuhr: row.prayers?.dhuhr !== false,
            asr: row.prayers?.asr !== false,
            maghrib: row.prayers?.maghrib !== false,
            isha: row.prayers?.isha !== false,
          },
        }
      : {
          latitude: DEFAULT_LOCATION.lat,
          longitude: DEFAULT_LOCATION.lng,
          locationName: DEFAULT_LOCATION.name,
          timezone: DEFAULT_LOCATION.timezone,
          method: DEFAULT_METHOD,
          madhab: DEFAULT_MADHAB,
          pushEnabled: false,
          prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
        }

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Salaah" />
        <SalaahClient initial={initial} />
      </div>
    </main>
  )
}
