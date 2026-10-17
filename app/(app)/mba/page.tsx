import { ScreenHeader } from '@/components/shell/screen-header'
import { requireUser } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { mergeDeadlines, type DeadlineKind, type DeadlineSource } from '@/lib/mba/classify'
import { matchEventsToSessions } from '@/lib/mba/agenda'
import type { FeedKind } from '@/lib/mba/sync-calendar'
import type { KeyDate, KeyDateKind } from '@/lib/mba/key-dates'
import { MbaClient } from './mba-client'
import type { CourseVM, DeadlineVM, EventVM, FeedVM, ReadingVM, SessionVM } from './types'

const DAY = 86_400_000

export default async function MbaPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const now = new Date()

  const [courses, sessions, deadlines, events, feeds, keyDates] = await Promise.all([
    supabase
      .from('mba_courses')
      .select('code, name, convenor, color')
      .eq('user_id', user.id)
      .order('code'),
    supabase
      .from('mba_sessions')
      .select(
        'id, course_code, session_key, sort_order, title, starts_at, ends_at, mode, readings, summary_source, notebook_url, prepared',
      )
      .eq('user_id', user.id)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .order('sort_order'),
    supabase
      .from('mba_deadlines')
      .select('id, course_code, title, kind, due_at, all_day, weight, details, source, done')
      .eq('user_id', user.id),
    supabase
      .from('mba_events')
      .select('id, title, starts_at, ends_at, all_day, location, join_url, course_code')
      .eq('user_id', user.id)
      .gte('starts_at', new Date(now.getTime() - 14 * DAY).toISOString())
      .lte('starts_at', new Date(now.getTime() + 120 * DAY).toISOString())
      .order('starts_at'),
    supabase
      .from('mba_calendar_feeds')
      .select('kind, url, last_synced_at, last_sync_error, last_sync_count')
      .eq('user_id', user.id),
    supabase
      .from('mba_key_dates')
      .select('id, title, kind, start_date, end_date, leave_days, programme_year, notes')
      .eq('user_id', user.id)
      .order('start_date'),
  ])

  const keyDateVMs: KeyDate[] = (keyDates.data ?? []).map((k) => ({
    id: k.id,
    title: k.title,
    kind: k.kind as KeyDateKind,
    startDate: k.start_date,
    endDate: k.end_date,
    // numeric columns arrive as numbers via PostgREST, but coerce defensively.
    leaveDays: k.leave_days == null ? null : Number(k.leave_days),
    year: k.programme_year,
    notes: k.notes,
  }))

  const eventVMs: EventVM[] = (events.data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    allDay: e.all_day,
    location: e.location,
    joinUrl: e.join_url,
    courseCode: e.course_code,
  }))

  const sessionRows = sessions.data ?? []
  // Mailbox invites that ARE timetable lectures lend their join link to the
  // session and are not listed again as separate meetings.
  const { eventBySession, matchedEventIds } = matchEventsToSessions(
    sessionRows.map((s) => ({ id: s.id, courseCode: s.course_code, startsAt: s.starts_at })),
    eventVMs,
  )
  const eventsById = new Map(eventVMs.map((e) => [e.id, e]))

  const sessionVMs: SessionVM[] = sessionRows.map((s) => ({
    id: s.id,
    courseCode: s.course_code,
    sessionKey: s.session_key,
    title: s.title,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    mode: s.mode,
    readings: (s.readings as ReadingVM[] | null) ?? [],
    hasSummary: s.summary_source !== null,
    notebookUrl: s.notebook_url,
    prepared: s.prepared,
    joinUrl: eventsById.get(eventBySession[s.id] ?? '')?.joinUrl ?? null,
  }))

  const deadlineVMs: DeadlineVM[] = mergeDeadlines(
    (deadlines.data ?? []).map((d) => ({
      id: d.id as string,
      courseCode: d.course_code as string | null,
      title: d.title as string,
      kind: d.kind as DeadlineKind,
      dueAt: d.due_at as string,
      allDay: d.all_day as boolean,
      weight: d.weight as string | null,
      details: d.details as string | null,
      source: d.source as DeadlineSource,
      done: d.done as boolean,
    })),
  )

  const feedVMs: FeedVM[] = (feeds.data ?? []).map((f) => ({
    kind: f.kind as FeedKind,
    host: new URL(f.url as string).host,
    lastSyncedAt: f.last_synced_at,
    lastSyncError: f.last_sync_error,
    lastSyncCount: f.last_sync_count,
  }))

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="MBA" />
        <MbaClient
          nowIso={now.toISOString()}
          courses={(courses.data ?? []) as CourseVM[]}
          sessions={sessionVMs}
          deadlines={deadlineVMs}
          meetings={eventVMs.filter((e) => !matchedEventIds.has(e.id))}
          feeds={feedVMs}
          keyDates={keyDateVMs}
        />
      </div>
    </main>
  )
}
