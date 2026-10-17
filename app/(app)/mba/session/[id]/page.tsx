import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ScreenHeader } from '@/components/shell/screen-header'
import { requireUser } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { matchEventsToSessions } from '@/lib/mba/agenda'
import { fmtLongDay, fmtTime } from '@/lib/mba/format'
import { Card, CourseChip, SectionTitle } from '../../parts'
import { SummaryView } from '../../summary-view'
import { SessionPrep } from './session-prep'
import type { CourseVM, ReadingVM } from '../../types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MATCH_MS = 45 * 60_000

export default async function MbaSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const user = await requireUser()
  const supabase = await createClient()

  const { data: s } = await supabase
    .from('mba_sessions')
    .select(
      'id, course_code, session_key, title, starts_at, ends_at, mode, readings, summary, summary_source, notebook_url, notes, prepared',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!s) notFound()

  const [{ data: course }, { data: siblings }, { data: nearEvents }] = await Promise.all([
    supabase
      .from('mba_courses')
      .select('code, name, convenor, color')
      .eq('user_id', user.id)
      .eq('code', s.course_code)
      .maybeSingle<CourseVM>(),
    supabase
      .from('mba_sessions')
      .select('id, session_key, starts_at, sort_order')
      .eq('user_id', user.id)
      .eq('course_code', s.course_code)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .order('sort_order'),
    s.starts_at
      ? supabase
          .from('mba_events')
          .select('id, course_code, starts_at, join_url, location')
          .eq('user_id', user.id)
          .gte('starts_at', new Date(Date.parse(s.starts_at) - MATCH_MS).toISOString())
          .lte('starts_at', new Date(Date.parse(s.starts_at) + MATCH_MS).toISOString())
      : Promise.resolve({ data: [] as { id: string; course_code: string | null; starts_at: string; join_url: string | null; location: string | null }[] }),
  ])

  const { eventBySession } = matchEventsToSessions(
    [{ id: s.id, courseCode: s.course_code, startsAt: s.starts_at }],
    (nearEvents ?? []).map((e) => ({ id: e.id, courseCode: e.course_code, startsAt: e.starts_at })),
  )
  const invite = (nearEvents ?? []).find((e) => e.id === eventBySession[s.id])

  const idx = (siblings ?? []).findIndex((x) => x.id === s.id)
  const prev = idx > 0 ? siblings![idx - 1] : undefined
  const next = idx >= 0 ? siblings![idx + 1] : undefined

  const readings = (s.readings as ReadingVM[] | null) ?? []
  const folders = [...new Set(readings.map((r) => r.path?.split('/').slice(0, -1).join('/')).filter(Boolean))]

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl space-y-3">
        <ScreenHeader
          title={`${s.course_code} ${s.session_key}`}
          backHref="/mba"
          backLabel="Back to MBA"
        />

        {/* Identity. */}
        <section className="rounded-[22px] border border-cream-300 bg-cream-50 p-[18px]">
          <div className="flex items-center gap-2">
            <CourseChip course={course ?? undefined} code={s.course_code} />
            <span className="truncate text-[12px] text-[#8a7163]">{course?.name}</span>
          </div>
          <h2 className="mt-2 font-serif text-[24px] leading-tight font-semibold text-terracotta-900">
            {s.title}
          </h2>
          <p className="mt-1.5 text-[13px] text-[#6B5547] tabular-nums">
            {s.starts_at
              ? `${fmtLongDay(s.starts_at)} · ${fmtTime(s.starts_at)}${s.ends_at ? `–${fmtTime(s.ends_at)}` : ''}`
              : 'Date to be confirmed'}
            {s.mode ? ` · ${s.mode === 'online' ? 'Online' : 'In person'}` : ''}
          </p>
          {course?.convenor ? <p className="mt-0.5 text-[12px] text-[#8a7163]">{course.convenor}</p> : null}
          {invite?.join_url ? (
            <a
              href={invite.join_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#7A9B7A] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#6A8B6A]"
            >
              Join online session
            </a>
          ) : null}
        </section>

        <SessionPrep
          id={s.id}
          prepared={s.prepared}
          notebookUrl={s.notebook_url}
          notes={s.notes}
          readingTitles={readings.map((r) => r.title)}
        />

        {/* Pre-reading. */}
        <Card>
          <SectionTitle>Pre-reading · {readings.filter((r) => r.kind !== 'slides').length}</SectionTitle>
          {readings.length === 0 ? (
            <p className="mt-3 text-[14px] text-[#8a7163]">No readings listed for this session.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5">
                {readings.map((r) => (
                  <li key={`${r.kind}-${r.title}`} className="flex items-start gap-2.5 rounded-[12px] bg-white px-3 py-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        r.kind === 'slides' ? 'bg-[#F1F5F1] text-sage-600' : 'bg-[#FBF2EE] text-terracotta-600'
                      }`}
                    >
                      {r.kind}
                    </span>
                    <span className="text-[14px] text-terracotta-900">{r.title}</span>
                  </li>
                ))}
              </ul>
              {folders.length ? (
                <p className="mt-2.5 text-[12px] text-[#8a7163]">
                  In your course folder: {folders.join(' · ')}
                </p>
              ) : null}
            </>
          )}
        </Card>

        {/* Summary. */}
        <Card>
          <SectionTitle>Summary</SectionTitle>
          {s.summary ? (
            <>
              <p className="mt-1.5 text-[12px] text-[#8a7163]">
                {s.summary_source === 'ai'
                  ? 'AI-generated from the readings — use it to prime, not replace, the reading.'
                  : 'From your session pre-reading notes.'}
              </p>
              <div className="mt-3">
                <SummaryView markdown={s.summary} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-[#8a7163]">
              No summary yet. It appears here after the next MBA sync on your computer, or add a
              NotebookLM link above.
            </p>
          )}
        </Card>

        {/* Prev / next in this course. */}
        <nav className="flex justify-between gap-3 pt-1">
          {prev ? (
            <Link href={`/mba/session/${prev.id}`} className="text-[13px] font-semibold text-sage-600 hover:underline">
              ← {s.course_code} {prev.session_key}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/mba/session/${next.id}`} className="text-[13px] font-semibold text-sage-600 hover:underline">
              {s.course_code} {next.session_key} →
            </Link>
          ) : null}
        </nav>
      </div>
    </main>
  )
}
