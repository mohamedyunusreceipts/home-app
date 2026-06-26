import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .single()

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">
            {household?.name ?? 'Home'}
          </h1>
          <Link href="/settings">
            <Button variant="outline">Settings</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Welcome, {user.email}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sage-700">
            <p>
              You&apos;re signed in and your household is set up. The full dashboard — meals,
              bills, chores, calendar — is being built next.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
