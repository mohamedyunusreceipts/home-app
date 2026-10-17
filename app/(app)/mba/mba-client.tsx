'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useShell } from '@/components/shell/shell-context'
import { setDeadlineDone, setSessionPrepared, syncCalendarsIfStale } from './actions'
import { NextLectureHero, StatsRow } from './hero'
import { AgendaSection } from './agenda-section'
import { DeadlinesSection } from './deadlines-section'
import { LecturesSection } from './lectures-section'
import { FeedsCard } from './feeds-card'
import { ProgrammeDatesCard } from './programme-dates'
import { buildStats, upcomingSessions } from './stats'
import type { KeyDate } from '@/lib/mba/key-dates'
import type { CourseVM, DeadlineVM, EventVM, FeedVM, SessionVM } from './types'

export function MbaClient({
  nowIso,
  courses,
  sessions,
  deadlines,
  meetings,
  feeds,
  keyDates,
}: {
  nowIso: string
  courses: CourseVM[]
  sessions: SessionVM[]
  deadlines: DeadlineVM[]
  meetings: EventVM[]
  feeds: FeedVM[]
  keyDates: KeyDate[]
}) {
  const router = useRouter()
  const { showToast } = useShell()
  const [, startTransition] = useTransition()
  const [now, setNow] = useState(() => new Date(nowIso))
  const [courseFilter, setCourseFilter] = useState<string | null>(null)
  // Optimistic ticks, layered over server props until the refresh lands.
  const [preparedOverride, setPreparedOverride] = useState<Record<string, boolean>>({})
  const [doneOverride, setDoneOverride] = useState<Record<string, boolean>>({})

  // Keep relative times fresh, and pull calendar feeds if the last sync is old.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    let cancelled = false
    syncCalendarsIfStale()
      .then((r) => {
        if (r.synced && !cancelled) router.refresh()
      })
      .catch(() => {})
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [router])

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.code, c])), [courses])

  const allSessions = useMemo(
    () => sessions.map((s) => ({ ...s, prepared: preparedOverride[s.id] ?? s.prepared })),
    [sessions, preparedOverride],
  )
  const allDeadlines = useMemo(
    () => deadlines.map((d) => ({ ...d, done: doneOverride[d.id] ?? d.done })),
    [deadlines, doneOverride],
  )
  const next = upcomingSessions(allSessions, now)[0]

  const togglePrepared = useCallback(
    (id: string, prepared: boolean) => {
      setPreparedOverride((o) => ({ ...o, [id]: prepared }))
      startTransition(async () => {
        const r = await setSessionPrepared(id, prepared)
        if ('error' in r) {
          setPreparedOverride((o) => ({ ...o, [id]: !prepared }))
          showToast(r.error)
        }
      })
    },
    [showToast],
  )

  const toggleDone = useCallback(
    (id: string, done: boolean) => {
      setDoneOverride((o) => ({ ...o, [id]: done }))
      startTransition(async () => {
        const r = await setDeadlineDone(id, done)
        if ('error' in r) {
          setDoneOverride((o) => ({ ...o, [id]: !done }))
          showToast(r.error)
        } else if (done) {
          showToast('Marked as done')
        }
      })
    },
    [showToast],
  )

  if (!courses.length && !sessions.length && !deadlines.length) {
    return (
      <div className="space-y-3">
        <section className="rounded-[22px] bg-[#C77B5C] p-[18px] text-cream-50">
          <p className="font-serif text-[24px] font-semibold">Your MBA, in one place</p>
          <p className="mt-2 text-[14px] text-cream-50/90">
            Nothing is loaded yet. Run the MBA sync on your computer to import your timetable,
            pre-readings and summaries, and connect your calendars below.
          </p>
        </section>
        <FeedsCard feeds={feeds} />
      </div>
    )
  }

  return (
    <MbaScreen
      now={now}
      next={next}
      courses={courses}
      courseMap={courseMap}
      sessions={allSessions}
      deadlines={allDeadlines}
      meetings={meetings}
      feeds={feeds}
      keyDates={keyDates}
      courseFilter={courseFilter}
      onCourseFilter={setCourseFilter}
      onTogglePrepared={togglePrepared}
      onToggleDone={toggleDone}
    />
  )
}

/** Presentational layout of the MBA screen (state lives in MbaClient). */
export function MbaScreen({
  now,
  next,
  courses,
  courseMap,
  sessions,
  deadlines,
  meetings,
  feeds,
  keyDates,
  courseFilter,
  onCourseFilter,
  onTogglePrepared,
  onToggleDone,
}: {
  now: Date
  next: SessionVM | undefined
  courses: CourseVM[]
  courseMap: Map<string, CourseVM>
  sessions: SessionVM[]
  deadlines: DeadlineVM[]
  meetings: EventVM[]
  feeds: FeedVM[]
  keyDates: KeyDate[]
  courseFilter: string | null
  onCourseFilter: (code: string | null) => void
  onTogglePrepared: (id: string, prepared: boolean) => void
  onToggleDone: (id: string, done: boolean) => void
}) {
  const filteredSessions = courseFilter ? sessions.filter((s) => s.courseCode === courseFilter) : sessions
  const filteredDeadlines = courseFilter ? deadlines.filter((d) => d.courseCode === courseFilter) : deadlines
  const selected = courseFilter ? courseMap.get(courseFilter) : undefined

  return (
    <div className="space-y-3">
      {next ? <NextLectureHero session={next} now={now} /> : null}
      <StatsRow stats={buildStats(sessions, deadlines, now)} />

      <AgendaSection
        now={now}
        sessions={sessions}
        meetings={meetings}
        deadlines={deadlines}
        keyDates={keyDates}
        courseMap={courseMap}
      />

      {courses.length > 1 ? (
        <div className="-mx-[22px] overflow-x-auto px-[22px] pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2">
            <FilterChip active={!courseFilter} onClick={() => onCourseFilter(null)}>
              All courses
            </FilterChip>
            {courses.map((c) => (
              <FilterChip
                key={c.code}
                active={courseFilter === c.code}
                color={c.color}
                onClick={() => onCourseFilter(courseFilter === c.code ? null : c.code)}
              >
                {c.code}
              </FilterChip>
            ))}
          </div>
          {selected ? (
            <p className="mt-2 text-[12px] text-[#8a7163]">
              {selected.name}
              {selected.convenor ? ` · ${selected.convenor}` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      <DeadlinesSection
        now={now}
        deadlines={filteredDeadlines}
        courses={courses}
        courseMap={courseMap}
        onToggleDone={onToggleDone}
      />
      <LecturesSection now={now} sessions={filteredSessions} courseMap={courseMap} onTogglePrepared={onTogglePrepared} />
      <ProgrammeDatesCard keyDates={keyDates} now={now} />
      <FeedsCard feeds={feeds} />
    </div>
  )
}

function FilterChip({
  active,
  color = '#7A9B7A',
  onClick,
  children,
}: {
  active: boolean
  color?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
      style={
        active
          ? { background: color, borderColor: color, color: '#FBF7EF' }
          : { background: '#FBF7EF', borderColor: '#E7DCC7', color: '#6B5547' }
      }
    >
      {children}
    </button>
  )
}
