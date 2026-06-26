import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInButton } from './sign-in-button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  // If already signed in, bounce to home (which routes to setup or dashboard).
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
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
          <SignInButton />
        </CardContent>
      </Card>
    </main>
  )
}
