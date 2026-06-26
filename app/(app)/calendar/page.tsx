import Link from 'next/link'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { ScreenHeader } from '@/components/shell/screen-header'
import { FocusTimeline } from '@/components/calendar/focus-timeline'
import type { CalendarEventRow } from '@/components/calendar/types'

export default async function CalendarPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  // v_calendar_all runs with security_invoker, so RLS scopes it to the caller's
  // household; the explicit eq is belt-and-braces and keeps the query intentful.
  const { data: rows } = await supabase
    .from('v_calendar_all')
    .select('household_id, source, source_id, title, start, end, all_day, category, link')
    .eq('household_id', householdId)
    .returns<CalendarEventRow[]>()

  // Current month in the app's timezone (Africa/Johannesburg).
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])

  return (
    <main className="px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-xl">
        <ScreenHeader
          title="Calendar"
          action={
            <Link
              href="/calendar/birthdays"
              className="inline-flex items-center rounded-full font-semibold transition-colors"
              style={{
                border: '1px solid #E8DFCE',
                background: '#FFFDF9',
                padding: '7px 16px',
                fontSize: 13,
                color: '#793F2D',
              }}
            >
              Birthdays
            </Link>
          }
        />

        <FocusTimeline rows={rows ?? []} year={year} month={month} />
      </div>
    </main>
  )
}
