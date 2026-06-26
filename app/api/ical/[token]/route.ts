import { type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { buildICalendar, type CalendarRow } from '@/lib/ical'

/**
 * GET /api/ical/[token] — the per-household iCalendar feed (spec §8.3).
 *
 * Calendar apps (iOS Calendar, Google Calendar) poll this URL without logging in,
 * so authorization is by the long random token alone — the token IS the
 * capability. We therefore use a service-role client (which bypasses RLS) to:
 *   1. resolve the household_id from the token (404 on unknown token), then
 *   2. read v_calendar_all filtered EXPLICITLY by that household_id.
 * The token table is the only thing that maps a caller to a household, so a
 * leaked token only ever exposes its own household's calendar — rotatable via
 * rotate_ical_token() in settings.
 *
 * The route is dynamic (never cached) so the feed always reflects current data.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  if (!token || token.length < 16) {
    // Too short to be a real feed token — don't even hit the DB.
    return notFound()
  }

  // Service-role client: the token is the capability, so we bypass RLS and filter
  // by household_id explicitly. Never exposes the service key to the client.
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: feed, error: feedError } = await supabase
    .from('ical_feed_tokens')
    .select('household_id')
    .eq('token', token)
    .maybeSingle<{ household_id: string }>()

  if (feedError || !feed) {
    return notFound()
  }

  const { data: rows, error: rowsError } = await supabase
    .from('v_calendar_all')
    .select('household_id, source, source_id, title, start, end, all_day, category, link')
    .eq('household_id', feed.household_id)
    .returns<CalendarRow[]>()

  if (rowsError) {
    return new Response('Failed to build calendar feed', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const appUrl =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? undefined

  const ics = buildICalendar(rows ?? [], {
    appUrl,
    calendarName: 'Home',
  })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="home.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
