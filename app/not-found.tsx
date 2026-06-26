import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Root 404 — also catches any unmatched URL across the whole app. Renders
 * inside the root layout, so the warm theme and serif fonts are available.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-3xl text-terracotta-700">
              We can&apos;t find that page
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sage-800">
            <p>
              The page you were after has either moved, been tidied away, or
              never quite existed. No harm done — let&apos;s get you back home.
            </p>
            <Link href="/dashboard">
              <Button>Take me home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
