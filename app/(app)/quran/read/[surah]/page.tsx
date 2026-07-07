import { notFound } from 'next/navigation'
import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { getSurah, type HifzStatus } from '@/lib/quran/surahs'
import { SurahReader } from './surah-reader'

interface HifzRow {
  status: string
}

export default async function SurahPage({
  params,
}: {
  params: Promise<{ surah: string }>
}) {
  const { surah: surahParam } = await params
  const surahNumber = Number(surahParam)
  const surah = Number.isInteger(surahNumber) ? getSurah(surahNumber) : undefined
  if (!surah) notFound()

  const { user } = await requireHousehold()
  const supabase = await createClient()

  const { data: hifz } = await supabase
    .from('quran_hifz')
    .select('status')
    .eq('user_id', user.id)
    .eq('surah_number', surah.number)
    .maybeSingle<HifzRow>()

  const initialStatus: HifzStatus | null =
    hifz?.status === 'memorised' || hifz?.status === 'learning' ? hifz.status : null

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title={surah.englishName} />

        {/* Surah identity strip. */}
        <section className="mb-3 rounded-[20px] border border-cream-300 bg-cream-50 px-[18px] py-4 text-center">
          <p
            className="font-arabic text-[30px] leading-tight text-terracotta-900"
            dir="rtl"
            lang="ar"
          >
            {surah.name}
          </p>
          <p className="mt-1 text-[13px] text-[#8a7163]">
            {surah.englishNameTranslation} · {surah.revelationType} ·{' '}
            {surah.ayahs.length} āyāt
          </p>
        </section>

        <SurahReader surah={surah} initialStatus={initialStatus} />
      </div>
    </main>
  )
}
