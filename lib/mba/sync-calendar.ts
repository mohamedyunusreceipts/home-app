// Pull a user's calendar-subscription feeds (ICS) into the MBA tables:
//   * kind 'lms'  (course site calendar, e.g. Brightspace): deliverables →
//     mba_deadlines (source 'lms'); everything else → mba_events.
//   * kind 'mail' (mailbox calendar, e.g. Outlook "Publish a calendar"):
//     everything → mba_events (team meetings, lecture invites with join links).
//
// Works with either a user-scoped client (server actions; RLS applies) or the
// service-role client (cron). Upserts never send user-owned columns (`done`),
// so ticks survive every sync.

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseICal } from './ical'
import { expandEvents } from './recurrence'
import { classifyEvent, detectCourse, type CourseMatcher } from './classify'
import { extractJoinUrl } from './agenda'

export type FeedKind = 'lms' | 'mail'

export interface FeedRow {
  id: string
  user_id: string
  kind: FeedKind
  url: string
}

const FETCH_TIMEOUT_MS = 15_000
const MAX_FEED_BYTES = 8_000_000
const DAY = 86_400_000
const PAST_WINDOW_MS = 14 * DAY
const FUTURE_WINDOW_MS: Record<FeedKind, number> = { lms: 400 * DAY, mail: 180 * DAY }
/** Past events older than this are pruned so the table can't grow forever. */
const EVENT_RETENTION_MS = 60 * DAY
const CHUNK = 500

/** Re-sync on page open when the last sync is older than this. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000

/**
 * Only public https hosts — the URL is user-supplied and fetched server-side, so
 * refuse loopback / private / link-local targets (SSRF guard).
 */
export function validateCalendarUrl(raw: string): { url: URL } | { error: string } {
  let url: URL
  try {
    // Outlook hands out webcal:// links; they're plain https underneath.
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'))
  } catch {
    return { error: 'That is not a valid link.' }
  }
  if (url.protocol !== 'https:') return { error: 'The calendar link must start with https://' }
  if (raw.length > 2000) return { error: 'That link is too long.' }
  const host = url.hostname.toLowerCase()
  const isIpLiteral =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')
  if (
    isIpLiteral ||
    host === 'localhost' ||
    !host.includes('.') ||
    /\.(local|localhost|internal|lan|home|test)$/.test(host)
  ) {
    return { error: 'The calendar link must point to a public website.' }
  }
  return { url }
}

export type SyncResult = { deadlines: number; events: number } | { error: string }

async function fetchFeed(url: URL): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1' },
    cache: 'no-store',
  })
  // A redirect must not land somewhere we'd have refused up front.
  if ('error' in validateCalendarUrl(res.url || url.toString())) {
    throw new Error('The calendar link redirected to a non-public address.')
  }
  if (!res.ok) throw new Error(`The calendar server replied ${res.status}.`)
  const text = await res.text()
  if (text.length > MAX_FEED_BYTES) throw new Error('The calendar feed is too large.')
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('That link did not return a calendar (.ics) feed.')
  }
  return text
}

async function upsertChunked(
  supabase: SupabaseClient,
  table: string,
  rows: object[],
  onConflict: string,
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict })
    if (error) throw new Error(`Could not save ${table.replace('mba_', '')}: ${error.message}`)
  }
}

async function deleteIds(supabase: SupabaseClient, table: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += CHUNK) {
    await supabase.from(table).delete().in('id', ids.slice(i, i + CHUNK))
  }
}

async function recordStatus(
  supabase: SupabaseClient,
  feedId: string,
  patch: { last_sync_error: string | null; last_sync_count?: number },
) {
  const now = new Date().toISOString()
  await supabase
    .from('mba_calendar_feeds')
    .update({ ...patch, last_synced_at: now, updated_at: now })
    .eq('id', feedId)
}

export async function syncFeed(
  supabase: SupabaseClient,
  feed: FeedRow,
  now: Date = new Date(),
): Promise<SyncResult> {
  const valid = validateCalendarUrl(feed.url)
  if ('error' in valid) {
    await recordStatus(supabase, feed.id, { last_sync_error: valid.error })
    return valid
  }

  try {
    const from = new Date(now.getTime() - PAST_WINDOW_MS)
    const to = new Date(now.getTime() + FUTURE_WINDOW_MS[feed.kind])
    const occurrences = expandEvents(parseICal(await fetchFeed(valid.url)), from, to)

    const { data: courseRows } = await supabase
      .from('mba_courses')
      .select('code, name, aliases')
      .eq('user_id', feed.user_id)
    const courses: CourseMatcher[] = (courseRows ?? []).map((c) => ({
      code: c.code as string,
      name: c.name as string,
      aliases: (c.aliases as string[] | null) ?? [],
    }))

    const stamp = now.toISOString()
    const deadlines: object[] = []
    const events: object[] = []
    const deadlineUids = new Set<string>()
    const eventUids = new Set<string>()

    for (const occ of occurrences) {
      const cls = feed.kind === 'lms' ? classifyEvent(occ, courses) : null
      if (cls) {
        if (deadlineUids.has(occ.uid)) continue
        deadlineUids.add(occ.uid)
        deadlines.push({
          user_id: feed.user_id,
          feed_id: feed.id,
          course_code: cls.courseCode,
          title: occ.summary || 'Untitled',
          kind: cls.kind,
          due_at: occ.start.toISOString(),
          all_day: occ.allDay,
          details: [occ.description, occ.url].filter(Boolean).join('\n').slice(0, 2000) || null,
          source: 'lms',
          external_uid: occ.uid,
          updated_at: stamp,
        })
      } else {
        if (eventUids.has(occ.uid)) continue
        eventUids.add(occ.uid)
        events.push({
          user_id: feed.user_id,
          feed_id: feed.id,
          external_uid: occ.uid,
          title: occ.summary || 'Untitled',
          starts_at: occ.start.toISOString(),
          ends_at: occ.end?.toISOString() ?? null,
          all_day: occ.allDay,
          location: occ.location.slice(0, 500) || null,
          details: occ.description.slice(0, 2000) || null,
          join_url: extractJoinUrl(occ.location, occ.description, occ.url),
          course_code: detectCourse(
            `${occ.summary}\n${occ.location}\n${occ.description}`,
            courses,
          ),
          updated_at: stamp,
        })
      }
    }

    await upsertChunked(supabase, 'mba_deadlines', deadlines, 'user_id,source,external_uid')
    await upsertChunked(supabase, 'mba_events', events, 'feed_id,external_uid')

    // Remove in-window items that vanished from the feed (deleted / moved)...
    const { data: oldDeadlines } = await supabase
      .from('mba_deadlines')
      .select('id, external_uid')
      .eq('feed_id', feed.id)
      .gte('due_at', from.toISOString())
    await deleteIds(
      supabase,
      'mba_deadlines',
      (oldDeadlines ?? []).filter((r) => !deadlineUids.has(r.external_uid as string)).map((r) => r.id as string),
    )
    const { data: oldEvents } = await supabase
      .from('mba_events')
      .select('id, external_uid')
      .eq('feed_id', feed.id)
      .gte('starts_at', from.toISOString())
    await deleteIds(
      supabase,
      'mba_events',
      (oldEvents ?? []).filter((r) => !eventUids.has(r.external_uid as string)).map((r) => r.id as string),
    )
    // ...and prune long-past events.
    await supabase
      .from('mba_events')
      .delete()
      .eq('feed_id', feed.id)
      .lt('starts_at', new Date(now.getTime() - EVENT_RETENTION_MS).toISOString())

    await recordStatus(supabase, feed.id, {
      last_sync_error: null,
      last_sync_count: deadlines.length + events.length,
    })
    return { deadlines: deadlines.length, events: events.length }
  } catch (e) {
    const message =
      e instanceof Error
        ? e.name === 'TimeoutError'
          ? 'The calendar server took too long to respond.'
          : e.message
        : 'Calendar sync failed.'
    await recordStatus(supabase, feed.id, { last_sync_error: message })
    return { error: message }
  }
}
