'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import {
  STALE_AFTER_MS,
  syncFeed,
  validateCalendarUrl,
  type FeedKind,
  type FeedRow,
} from '@/lib/mba/sync-calendar'
import type { DeadlineKind } from '@/lib/mba/classify'
import { zonedToUtc } from '@/lib/mba/ical'
import { MBA_TZ } from '@/lib/mba/dates'

export type ActionResult = { error: string } | { success: true }

// Every query is additionally scoped by user_id, on top of RLS.

function refresh(sessionId?: string) {
  revalidatePath('/mba')
  if (sessionId) revalidatePath(`/mba/session/${sessionId}`)
}

export async function setSessionPrepared(id: string, prepared: boolean): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from('mba_sessions')
    .update({ prepared, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: `Could not update session: ${error.message}` }
  refresh(id)
  return { success: true }
}

export async function saveSessionDetails(
  id: string,
  input: { notebookUrl: string; notes: string },
): Promise<ActionResult> {
  const user = await requireUser()
  const notebookUrl = input.notebookUrl.trim()
  if (notebookUrl) {
    try {
      const u = new URL(notebookUrl)
      if (u.protocol !== 'https:') return { error: 'The NotebookLM link must start with https://' }
    } catch {
      return { error: 'That NotebookLM link is not a valid URL.' }
    }
    if (notebookUrl.length > 2000) return { error: 'That link is too long.' }
  }
  if (input.notes.length > 20_000) return { error: 'Notes are too long.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mba_sessions')
    .update({
      notebook_url: notebookUrl || null,
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: `Could not save: ${error.message}` }
  refresh(id)
  return { success: true }
}

export async function setDeadlineDone(id: string, done: boolean): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from('mba_deadlines')
    .update({ done, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: `Could not update deadline: ${error.message}` }
  refresh()
  return { success: true }
}

const KINDS: DeadlineKind[] = ['assignment', 'exam', 'quiz', 'presentation', 'other']

export async function addManualDeadline(input: {
  title: string
  courseCode: string | null
  kind: DeadlineKind
  date: string // YYYY-MM-DD (SAST)
  time: string // HH:MM, or '' for all-day
}): Promise<ActionResult> {
  const user = await requireUser()
  const title = input.title.trim()
  if (!title) return { error: 'Give the deadline a title.' }
  if (title.length > 200) return { error: 'That title is too long.' }
  if (!KINDS.includes(input.kind)) return { error: 'Unknown type.' }
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date)
  if (!d) return { error: 'Pick a date.' }
  const t = input.time ? /^(\d{2}):(\d{2})$/.exec(input.time) : null
  if (input.time && !t) return { error: 'That time is not valid.' }

  const allDay = !t
  const dueAt = zonedToUtc(
    Number(d[1]),
    Number(d[2]),
    Number(d[3]),
    t ? Number(t[1]) : 23,
    t ? Number(t[2]) : 59,
    0,
    MBA_TZ,
  )

  const supabase = await createClient()
  const { error } = await supabase.from('mba_deadlines').insert({
    user_id: user.id,
    course_code: input.courseCode || null,
    title,
    kind: input.kind,
    due_at: dueAt.toISOString(),
    all_day: allDay,
    source: 'manual',
    external_uid: crypto.randomUUID(),
  })
  if (error) return { error: `Could not add deadline: ${error.message}` }
  refresh()
  return { success: true }
}

export async function deleteManualDeadline(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from('mba_deadlines')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('source', 'manual')
  if (error) return { error: `Could not delete: ${error.message}` }
  refresh()
  return { success: true }
}

export type SyncActionResult =
  | { error: string }
  | { success: true; deadlines: number; events: number }

const FEED_KINDS: FeedKind[] = ['lms', 'mail']

/**
 * Connect (or, with '', disconnect) a calendar feed, then sync it straight
 * away. Disconnecting deletes the feed row, which cascades to everything it
 * imported.
 */
export async function saveCalendarFeed(kind: FeedKind, rawUrl: string): Promise<SyncActionResult> {
  const user = await requireUser()
  if (!FEED_KINDS.includes(kind)) return { error: 'Unknown calendar type.' }
  const supabase = await createClient()

  if (!rawUrl.trim()) {
    const { error } = await supabase
      .from('mba_calendar_feeds')
      .delete()
      .eq('user_id', user.id)
      .eq('kind', kind)
    if (error) return { error: `Could not disconnect: ${error.message}` }
    refresh()
    return { success: true, deadlines: 0, events: 0 }
  }

  const valid = validateCalendarUrl(rawUrl)
  if ('error' in valid) return valid

  const { data: feed, error } = await supabase
    .from('mba_calendar_feeds')
    .upsert(
      {
        user_id: user.id,
        kind,
        url: valid.url.toString(),
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,kind' },
    )
    .select('id, user_id, kind, url')
    .single<FeedRow>()
  if (error || !feed) return { error: `Could not save link: ${error?.message ?? 'unknown error'}` }

  const result = await syncFeed(supabase, feed)
  refresh()
  return 'error' in result ? result : { success: true, ...result }
}

async function syncFeeds(onlyStale: boolean): Promise<SyncActionResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: feeds } = await supabase
    .from('mba_calendar_feeds')
    .select('id, user_id, kind, url, last_synced_at')
    .eq('user_id', user.id)

  const due = (feeds ?? []).filter(
    (f) =>
      !onlyStale ||
      !f.last_synced_at ||
      Date.now() - Date.parse(f.last_synced_at as string) >= STALE_AFTER_MS,
  )
  if (!onlyStale && !due.length) return { error: 'Connect a calendar first.' }

  let deadlines = 0
  let events = 0
  const errors: string[] = []
  for (const f of due) {
    const r = await syncFeed(supabase, f as FeedRow)
    if ('error' in r) errors.push(r.error)
    else {
      deadlines += r.deadlines
      events += r.events
    }
  }
  if (due.length) refresh()
  return errors.length ? { error: errors.join(' ') } : { success: true, deadlines, events }
}

export async function syncCalendarsNow(): Promise<SyncActionResult> {
  return syncFeeds(false)
}

/** Called when the MBA page opens: re-sync only feeds whose last sync is stale. */
export async function syncCalendarsIfStale(): Promise<{ synced: boolean }> {
  const r = await syncFeeds(true)
  return { synced: !('error' in r) && r.deadlines + r.events > 0 }
}
