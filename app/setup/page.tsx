import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth/redirects'
import { getCurrentHouseholdId } from '@/lib/auth/current-household'

export default async function SetupPage() {
  await requireUser()
  // If already in a household, skip setup.
  const householdId = await getCurrentHouseholdId()
  if (householdId) redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Set up your household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sage-700">
            Two ways to start: create a new household, or join the one your partner
            already created using their invite link.
          </p>

          <div className="space-y-3">
            <Link href="/setup/create" className="block">
              <Button className="w-full">Create a new household</Button>
            </Link>
            <p className="text-sm text-sage-600 text-center">
              Or paste the invite link your partner shared with you into your browser to
              join their household.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
