import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { syncFeed, STALE_AFTER_MS, type FeedRow } from '@/lib/mba/sync-calendar'

/**
 * POST|GET /api/cron/mba — refresh every user's MBA calendar feeds (LMS +
 * mailbox ICS links) in the background, so deadlines and meetings are current
 * even when the MBA page hasn't been opened. Optional: the page also re-syncs
 * stale feeds when opened. See docs/mba-cron.md. Auth: shared CRON_SECRET.
 *
 * Only feeds not synced within STALE_AFTER_MS are fetched, so an hourly
 * schedule costs at most one fetch per feed per ~6 hours.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_FEEDS_PER_RUN = 25

async function handle(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString()
  const { data: feeds, error } = await supabase
    .from('mba_calendar_feeds')
    .select('id, user_id, kind, url')
    .or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(MAX_FEEDS_PER_RUN)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let synced = 0
  let failed = 0
  for (const feed of (feeds ?? []) as FeedRow[]) {
    // syncFeed records its own errors on the feed row; never let one feed 500 the job.
    try {
      const r = await syncFeed(supabase, feed)
      if ('error' in r) failed++
      else synced++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ checked: feeds?.length ?? 0, synced, failed })
}

export async function POST(request: NextRequest): Promise<Response> {
  return handle(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return handle(request)
}
