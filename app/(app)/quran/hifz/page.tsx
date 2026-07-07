import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { type HifzStatus } from '@/lib/quran/surahs'
import { HifzClient, type HifzState } from './hifz-client'

interface HifzRow {
  surah_number: number
  status: string
  last_revised_on: string | null
}

export default async function HifzPage() {
  const { user } = await requireHousehold()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('quran_hifz')
    .select('surah_number, status, last_revised_on')
    .eq('user_id', user.id)
    .returns<HifzRow[]>()

  const initial: Record<number, HifzState> = {}
  for (const row of rows ?? []) {
    const status: HifzStatus =
      row.status === 'memorised' ? 'memorised' : 'learning'
    initial[row.surah_number] = { status, lastRevisedOn: row.last_revised_on }
  }

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Ḥifẓ" />
        <HifzClient initial={initial} />
      </div>
    </main>
  )
}
