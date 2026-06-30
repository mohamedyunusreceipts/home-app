import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { sendPushToUser } from '@/lib/notifications/push'
import { createNotification } from '@/lib/notifications'
import {
  computePrayerTimes,
  NOTIFIABLE_PRAYERS,
  type ComputedTimes,
  type NotifiablePrayer,
} from '@/lib/salaah/compute'

/**
 * POST|GET /api/cron/salaah — fire push notifications at each prayer time.
 *
 * Designed to be hit once a minute (e.g. by Supabase pg_cron + pg_net — see
 * docs/salaah-cron.md). Auth is a shared secret in the Authorization header.
 *
 * For every household with push enabled it computes today's times in that
 * household's own timezone/coords/method/madhab, and for each enabled prayer
 * whose time just passed (within the last ~6 minutes) it fans a push out to
 * every member — exactly once, deduped via the salaah_notify_log unique
 * constraint so concurrent/overlapping runs never double-send.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A prayer fires if its time is in the window (now - WINDOW_MS, now]. The 6-min
// window tolerates minute-granularity cron jitter and brief outages without
// re-firing already-logged prayers (the log dedupes those).
const WINDOW_MS = 6 * 60 * 1000

const PRAYER_LABEL: Record<NotifiablePrayer, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

interface SettingsRow {
  household_id: string
  latitude: number | null
  longitude: number | null
  timezone: string | null
  method: string
  madhab: string
  prayers: Record<string, boolean> | null
}

/** YYYY-MM-DD for `date` in the given IANA timezone (the prayer_date log key). */
function localDateKey(date: Date, timezone: string): string {
  // en-CA yields YYYY-MM-DD; pin to the location's zone so the key flips at the
  // location's local midnight, not the server's.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

async function handle(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: rows, error } = await supabase
    .from('salaah_settings')
    .select('household_id, latitude, longitude, timezone, method, madhab, prayers')
    .eq('push_enabled', true)
    .returns<SettingsRow[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = new Date()
  let checked = 0
  let sent = 0

  for (const row of rows ?? []) {
    checked += 1
    try {
      if (row.latitude == null || row.longitude == null) continue
      const timezone = row.timezone ?? 'Africa/Johannesburg'

      const times: ComputedTimes = computePrayerTimes({
        lat: row.latitude,
        lng: row.longitude,
        methodKey: row.method,
        madhabKey: row.madhab,
        date: now,
      })

      const prayerDate = localDateKey(now, timezone)

      for (const prayer of NOTIFIABLE_PRAYERS) {
        // Skip prayers the household has switched off.
        if (row.prayers?.[prayer] === false) continue

        const t = times[prayer].getTime()
        const nowMs = now.getTime()
        const due = t <= nowMs && t > nowMs - WINDOW_MS
        if (!due) continue

        // Dedupe: claim the (household, date, prayer) slot first. If the row
        // already exists the unique constraint makes this a no-op and we skip —
        // so only the first run for this prayer actually sends.
        const { error: logError } = await supabase
          .from('salaah_notify_log')
          .insert({
            household_id: row.household_id,
            prayer_date: prayerDate,
            prayer,
          })
        if (logError) {
          // 23505 = unique_violation → already sent; any other error → skip safely.
          continue
        }

        // Fan out to every member of the household.
        const { data: members } = await supabase
          .from('household_members')
          .select('user_id')
          .eq('household_id', row.household_id)
          .returns<{ user_id: string }[]>()

        const label = PRAYER_LABEL[prayer]
        for (const m of members ?? []) {
          try {
            await sendPushToUser(supabase, m.user_id, {
              title: label,
              body: `It's time for ${label}`,
              link: '/salaah',
              tag: `salaah-${prayer}-${prayerDate}`,
            })
            await createNotification(supabase, {
              householdId: row.household_id,
              userId: m.user_id,
              kind: 'salaah',
              title: label,
              body: `It's time for ${label}`,
              link: '/salaah',
            })
          } catch (memberErr) {
            console.error('[cron/salaah] member notify failed:', memberErr)
          }
        }
        sent += 1
      }
    } catch (householdErr) {
      // Never let one household's failure 500 the whole job.
      console.error('[cron/salaah] household failed:', row.household_id, householdErr)
    }
  }

  return NextResponse.json({ checked, sent })
}

export async function POST(request: NextRequest): Promise<Response> {
  return handle(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return handle(request)
}
