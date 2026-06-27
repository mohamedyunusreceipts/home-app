import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { AcceptInviteForm } from './accept-form'

export default async function JoinInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const user = await getCurrentUser()

  // Anonymous visitors are sent to sign in; preserve the invite token via `next`.
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Join the household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            You&apos;ve been invited to join a household on Home. Accepting will add you as
            the partner.
          </p>
          <AcceptInviteForm token={token} />
        </CardContent>
      </Card>
    </main>
  )
}
