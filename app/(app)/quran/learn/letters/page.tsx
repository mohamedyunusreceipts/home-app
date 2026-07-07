import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { getCompletedLessons } from '../progress'
import { LettersClient } from './letters-client'
import { MarkComplete } from '../mark-complete'

const LESSON_ID = 'level-1-letters'

export default async function LettersLessonPage() {
  const { user } = await requireHousehold()
  const completed = await getCompletedLessons(user.id)

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Letters" />

        <section className="mb-3 rounded-[20px] bg-[#C77B5C] p-[18px] text-cream-50">
          <p className="text-[11px] font-semibold tracking-[0.07em] text-cream-50/85 uppercase">
            Level 1 · Ḥurūf
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-cream-50/95">
            The Arabic alphabet has 28 letters. Learn to recognise and name each one,
            then tap a letter to see how it changes shape at the start, middle, and end
            of a word.
          </p>
        </section>

        <p className="mb-3 rounded-[14px] border border-cream-300 bg-cream-100/60 px-4 py-2.5 text-[12px] text-[#8a7163]">
          Letter audio is coming soon. For now, use the transliteration under each letter
          as a sounding guide.
        </p>

        <LettersClient />

        <div className="mt-4">
          <MarkComplete lessonId={LESSON_ID} initialDone={completed.has(LESSON_ID)} />
        </div>
      </div>
    </main>
  )
}
