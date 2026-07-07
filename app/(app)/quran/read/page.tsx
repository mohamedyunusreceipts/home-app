import Link from 'next/link'
import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { SURAHS } from '@/lib/quran/surahs'

interface HifzRow {
  surah_number: number
  status: string
}

export default async function QuranReadPage() {
  const { user } = await requireHousehold()
  const supabase = await createClient()

  const { data: hifzRows } = await supabase
    .from('quran_hifz')
    .select('surah_number, status')
    .eq('user_id', user.id)
    .returns<HifzRow[]>()

  const statusBySurah = new Map<number, string>(
    (hifzRows ?? []).map((r) => [r.surah_number, r.status]),
  )

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Read" />

        <ul className="space-y-2">
          {SURAHS.map((surah) => {
            const status = statusBySurah.get(surah.number)
            return (
              <li key={surah.number}>
                <Link
                  href={`/quran/read/${surah.number}`}
                  className="flex items-center gap-3.5 rounded-[16px] border border-cream-300 bg-cream-50 px-[16px] py-[13px] transition-colors hover:bg-cream-100"
                >
                  <span className="flex size-[40px] shrink-0 items-center justify-center rounded-full bg-[#F1F5F1] font-serif text-[15px] font-semibold text-[#3B523C]">
                    {surah.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold text-terracotta-900">
                        {surah.englishName}
                      </p>
                      {status === 'memorised' ? (
                        <span className="shrink-0 rounded-full bg-[#F1F5F1] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sage-600 uppercase">
                          Memorised
                        </span>
                      ) : status === 'learning' ? (
                        <span className="shrink-0 rounded-full bg-[#FBF2EE] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-terracotta-600 uppercase">
                          Learning
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[#8a7163]">
                      {surah.englishNameTranslation} · {surah.ayahs.length} āyāt
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-arabic text-[20px] text-terracotta-800"
                    lang="ar"
                    dir="rtl"
                  >
                    {surah.name}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
