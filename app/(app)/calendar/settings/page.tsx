import Link from 'next/link'
import { headers } from 'next/headers'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FeedCard } from '@/components/calendar/feed-card'

export default async function CalendarSettingsPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: feed } = await supabase
    .from('ical_feed_tokens')
    .select('token')
    .eq('household_id', householdId)
    .maybeSingle<{ token: string }>()

  // Derive the app origin from the request so the feed URL is copy-pasteable.
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const origin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Calendar feed</h1>
          <Link href="/calendar">
            <Button variant="outline" size="sm">
              Back to calendar
            </Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Subscribe from your phone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sage-800">
            <p className="text-sm text-sage-600">
              Add this read-only feed to iOS Calendar, Google Calendar or any app that
              supports iCal subscriptions. It shows your bills, chores, meals, trips,
              birthdays, maintenance and manual events. The link contains a secret token —
              if it ever leaks, rotate it below to invalidate the old one.
            </p>
            <FeedCard initialToken={feed?.token ?? null} origin={origin} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
