import Link from 'next/link'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContactsManager } from '@/components/calendar/contacts-manager'
import type { ContactRow } from '@/components/calendar/types'

export default async function BirthdaysPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, household_id, name, dob, relationship, gift_ideas_text')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .returns<ContactRow[]>()

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Birthdays &amp; contacts</h1>
          <Link href="/calendar">
            <Button variant="outline" size="sm">
              Back to calendar
            </Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">People</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-sage-600">
              Birthdays you add here show up on the calendar automatically — the next
              upcoming one for each person, every year.
            </p>
            <ContactsManager contacts={contacts ?? []} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
