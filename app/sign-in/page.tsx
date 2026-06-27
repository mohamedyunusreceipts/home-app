import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInButton } from './sign-in-button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { safeRelativePath } from '@/lib/auth/redirects'
import { redirect } from 'next/navigation'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  const user = await getCurrentUser()
  if (user) redirect(safeRelativePath(next))

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Welcome home
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            Shared home management for couples. Sign in with the Google account you want
            tied to your household.
          </p>
          {error && (
            <p className="text-sm text-terracotta-700" role="alert">
              {decodeURIComponent(error)}
            </p>
          )}
          <SignInButton nextPath={next} />
        </CardContent>
      </Card>
    </main>
  )
}
