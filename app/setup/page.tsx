import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/redirects'
import { getCurrentHouseholdId } from '@/lib/auth/current-household'
import { JoinInput } from './join-input'

export default async function SetupPage() {
  await requireUser()
  // If already in a household, skip setup.
  const householdId = await getCurrentHouseholdId()
  if (householdId) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Set up your household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary path: join your partner's existing household. */}
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-sage-800">Joining your partner?</h2>
              <p className="mt-1 text-sm text-sage-600">
                Paste the invite link or code they generated in Settings &rarr; Invite.
              </p>
            </div>
            <JoinInput />
          </section>

          {/* Divider. */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-sage-200" />
            <span className="text-xs uppercase tracking-wide text-sage-400">or</span>
            <span className="h-px flex-1 bg-sage-200" />
          </div>

          {/* Secondary path: create a brand-new household. */}
          <section className="space-y-2">
            <Link
              href="/setup/create"
              className="block rounded-md border border-sage-300 bg-cream-50 px-4 py-3 text-center text-sm font-semibold text-sage-800 transition-colors hover:bg-cream-100"
            >
              Start a new household
            </Link>
            <p className="text-xs text-sage-500">
              Only do this if your partner hasn&apos;t set one up yet &mdash; otherwise ask them for
              an invite link so you don&apos;t end up in separate households.
            </p>
          </section>
        </CardContent>
      </Card>
    </main>
  )
}
