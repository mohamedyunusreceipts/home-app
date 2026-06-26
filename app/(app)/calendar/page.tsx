import Link from 'next/link'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { MonthView } from '@/components/calendar/month-view'
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
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl text-terracotta-700">Calendar</h1>
          <div className="flex gap-2">
            <Link href="/calendar/birthdays">
              <Button variant="outline" size="sm">
                Birthdays
              </Button>
            </Link>
            <Link href="/calendar/settings">
              <Button variant="outline" size="sm">
                Feed &amp; settings
              </Button>
            </Link>
          </div>
        </header>

        <MonthView rows={rows ?? []} initialYear={year} initialMonth={month} />
      </div>
    </main>
  )
}
