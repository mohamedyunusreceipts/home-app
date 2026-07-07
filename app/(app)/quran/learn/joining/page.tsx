import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { WORDS } from '@/lib/quran/basics'
import { getCompletedLessons } from '../progress'
import { MarkComplete } from '../mark-complete'

const LESSON_ID = 'level-3-joining'

export default async function JoiningLessonPage() {
  const { user } = await requireHousehold()
  const completed = await getCompletedLessons(user.id)

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Joining words" />

        <section className="mb-3 rounded-[20px] bg-[#C77B5C] p-[18px] text-cream-50">
          <p className="text-[11px] font-semibold tracking-[0.07em] text-cream-50/85 uppercase">
            Level 3 · Waṣl
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-cream-50/95">
            When letters sit together they join up and change shape to form a word. Each
            card shows the separate letters, then the joined word, its sound, and meaning.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-2">
          {WORDS.map((w) => (
            <div
              key={w.word}
              className="rounded-[16px] border border-cream-300 bg-cream-50 p-[18px]"
            >
              <div className="flex items-center justify-between gap-4">
                {/* Separate letters (reading order right-to-left). */}
                <div
                  className="flex flex-wrap justify-end gap-1.5"
                  dir="rtl"
                  lang="ar"
                >
                  {w.letters.map((ltr, i) => (
                    <span
                      key={`${w.word}-${i}`}
                      className="inline-flex size-[38px] items-center justify-center rounded-[10px] bg-cream-100 font-arabic text-[24px] text-[#8a7163]"
                    >
                      {ltr}
                    </span>
                  ))}
                </div>
                {/* Joined word. */}
                <p
                  className="font-arabic text-[40px] leading-none text-terracotta-900"
                  dir="rtl"
                  lang="ar"
                >
                  {w.word}
                </p>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-[#F2EBDF] pt-3">
                <p className="text-[14px] italic text-[#8a7163]">{w.translit}</p>
                <p className="text-[14px] font-semibold text-terracotta-900">{w.meaning}</p>
              </div>
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
