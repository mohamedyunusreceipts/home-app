import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { getSurah } from '@/lib/quran/surahs'
import { TAJWEED_RULES } from '@/lib/quran/tajweed'
import { getCompletedLessons } from '../progress'
import { MarkComplete } from '../mark-complete'
import { TajweedClient, type EnrichedRule } from './tajweed-client'

const LESSON_ID = 'level-4-tajweed'

export default async function TajweedLessonPage() {
  const { user } = await requireHousehold()
  const completed = await getCompletedLessons(user.id)

  // Enrich each example with its ayah Arabic text + surah name from the dataset.
  // Any example whose surah/ayah is missing is dropped (guarded by unit tests).
  const rules: EnrichedRule[] = TAJWEED_RULES.map((rule) => ({
    ...rule,
    examples: rule.examples.flatMap((ex) => {
      const surah = getSurah(ex.surah)
      const ayah = surah?.ayahs.find((a) => a.number === ex.ayah)
      if (!surah || !ayah) return []
      return [
        {
          surah: ex.surah,
          ayah: ex.ayah,
          note: ex.note,
          arabic: ayah.arabic,
          surahName: surah.englishName,
        },
      ]
    }),
  }))

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Tajwīd" />

        <section className="mb-3 rounded-[20px] bg-[#C77B5C] p-[18px] text-cream-50">
          <p className="text-[11px] font-semibold tracking-[0.07em] text-cream-50/85 uppercase">
            Level 4 · Tajwīd
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-cream-50/95">
            Tajwīd is the set of rules for reciting the Qur&apos;an correctly and beautifully.
            Tap a rule to read it, then play the example āyah to hear it in context.
          </p>
        </section>

        <TajweedClient rules={rules} />

        <p className="mt-4 text-center text-[11px] text-[#8a7163]">
          Example audio: Mishary Alafasy (everyayah.com)
        </p>

        <div className="mt-2">
          <MarkComplete lessonId={LESSON_ID} initialDone={completed.has(LESSON_ID)} />
        </div>
      </div>
    </main>
  )
}
