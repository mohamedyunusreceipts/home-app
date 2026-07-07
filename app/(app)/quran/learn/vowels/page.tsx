import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { HARAKAT } from '@/lib/quran/basics'
import { getCompletedLessons } from '../progress'
import { MarkComplete } from '../mark-complete'

const LESSON_ID = 'level-2-vowels'

export default async function VowelsLessonPage() {
  const { user } = await requireHousehold()
  const completed = await getCompletedLessons(user.id)

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Vowels &amp; sounds" />

        <section className="mb-3 rounded-[20px] bg-[#C77B5C] p-[18px] text-cream-50">
          <p className="text-[11px] font-semibold tracking-[0.07em] text-cream-50/85 uppercase">
            Level 2 · Ḥarakāt
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-cream-50/95">
            Arabic letters carry small marks that set the vowel sound. Below, each mark is
            shown on the letter bā (ب) with its transliteration and a short note.
          </p>
        </section>

        <p className="mb-3 rounded-[14px] border border-cream-300 bg-cream-100/60 px-4 py-2.5 text-[12px] text-[#8a7163]">
          Audio for individual sounds is coming soon; use the transliteration as a guide.
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {HARAKAT.map((h) => (
            <div
              key={h.id}
              className="rounded-[16px] border border-cream-300 bg-cream-50 p-[18px]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-terracotta-900">{h.name}</p>
                  <p className="text-[13px] text-[#8a7163]" dir="rtl" lang="ar">
                    {h.arabicName}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="font-arabic text-[42px] leading-none text-terracotta-900"
                    dir="rtl"
                    lang="ar"
                  >
                    {h.sample}
                  </p>
                  <p className="mt-1 text-[13px] italic text-[#8a7163]">{h.translit}</p>
                </div>
              </div>
              <p className="mt-3 border-t border-[#F2EBDF] pt-3 text-[13px] leading-relaxed text-terracotta-900">
                {h.explanation}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <MarkComplete lessonId={LESSON_ID} initialDone={completed.has(LESSON_ID)} />
        </div>
      </div>
    </main>
  )
}
