import Link from 'next/link'
import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { LEVELS } from '@/lib/quran/surahs'

interface HifzRow {
  surah_number: number
  status: string
}

interface ProgressRow {
  current_level: number
  completed_lessons: string[] | null
}

export default async function QuranPage() {
  // Auth via requireHousehold (app convention), but progress is keyed per-user.
  const { user } = await requireHousehold()
  const supabase = await createClient()

  const [{ data: hifzRows }, { data: progress }] = await Promise.all([
    supabase
      .from('quran_hifz')
      .select('surah_number, status')
      .eq('user_id', user.id)
      .returns<HifzRow[]>(),
    supabase
      .from('quran_progress')
      .select('current_level, completed_lessons')
      .eq('user_id', user.id)
      .maybeSingle<ProgressRow>(),
  ])

  const memorisedCount = (hifzRows ?? []).filter((r) => r.status === 'memorised').length
  const learningRow = (hifzRows ?? []).find((r) => r.status === 'learning')
  const continueSurah = learningRow?.surah_number ?? null
  const currentLevel = progress?.current_level ?? 5
  const completedLessons = new Set(progress?.completed_lessons ?? [])

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Qur'an" />

        {/* Hero — memorised count + continue reading. */}
        <section className="rounded-[22px] bg-[#C77B5C] p-[18px] text-cream-50">
          <p className="text-[11px] font-semibold tracking-[0.07em] text-cream-50/85 uppercase">
            Your journey
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <p className="font-serif text-[clamp(28px,9vw,38px)] font-semibold leading-none">
              {memorisedCount}{' '}
              <span className="text-[16px] font-medium text-cream-50/85">
                sūrah{memorisedCount === 1 ? '' : 's'} memorised
              </span>
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={continueSurah ? `/quran/read/${continueSurah}` : '/quran/read'}
              className="inline-flex items-center rounded-full bg-cream-50 px-4 py-2 text-[13px] font-semibold text-terracotta-600 transition-opacity hover:opacity-90"
            >
              {continueSurah ? 'Continue reading' : 'Start reading'}
            </Link>
            <Link
              href="/quran/hifz"
              className="inline-flex items-center rounded-full border border-cream-50/40 px-4 py-2 text-[13px] font-semibold text-cream-50 transition-colors hover:bg-cream-50/10"
            >
              Memorisation tracker
            </Link>
          </div>
        </section>

        {/* Level ladder. */}
        <h2 className="mt-6 mb-3 text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
          Learning ladder
        </h2>
        <div className="space-y-2">
          {LEVELS.map((lvl) => {
            const isReady = lvl.status === 'ready'
            const isCurrent = lvl.level === currentLevel && isReady
            const isDone = lvl.lessonId != null && completedLessons.has(lvl.lessonId)

            const inner = (
              <div className="flex items-center gap-3.5">
                <span
                  className={`flex size-[38px] shrink-0 items-center justify-center rounded-full font-serif text-[16px] font-semibold ${
                    isDone
                      ? 'bg-[#7A9B7A] text-cream-50'
                      : isReady
                        ? 'bg-[#F1F5F1] text-[#3B523C]'
                        : 'bg-cream-200 text-[#8a7163]'
                  }`}
                >
                  {isDone ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    lvl.level
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-[15px] font-semibold ${
                        isReady ? 'text-terracotta-900' : 'text-[#8a7163]'
                      }`}
                    >
                      {lvl.title}
                    </p>
                    <span
                      className="text-[13px] text-[#8a7163]"
                      lang="ar"
                    >
                      {lvl.arabicLabel}
                    </span>
                    {isDone ? (
                      <span className="rounded-full bg-[#F1F5F1] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sage-600 uppercase">
                        Done
                      </span>
                    ) : isCurrent ? (
                      <span className="rounded-full bg-[#F1F5F1] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sage-600 uppercase">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#8a7163]">
                    {isReady ? lvl.description : 'Coming soon'}
                  </p>
                </div>
                {isReady ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#C8B79C"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#C8B79C"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                )}
              </div>
            )

            const cardClass =
              'block rounded-[16px] border border-cream-300 px-[18px] py-[14px]'

            return isReady && lvl.href ? (
              <Link
                key={lvl.level}
                href={lvl.href}
                className={`${cardClass} bg-cream-50 transition-colors hover:bg-cream-100`}
              >
                {inner}
              </Link>
            ) : (
              <div
                key={lvl.level}
                aria-disabled="true"
                className={`${cardClass} bg-cream-100/60`}
              >
                {inner}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
