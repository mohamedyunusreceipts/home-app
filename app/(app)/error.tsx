'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for the authenticated (app) group — catches runtime errors in
 * any module page and shows a warm, reassuring fallback instead of a crash.
 *
 * This Next.js version (16.2) passes `unstable_retry` to re-fetch and re-render
 * the segment; older builds pass `reset`. We accept both and prefer whichever
 * is provided so the retry button always works.
 */
export default function AppError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl text-terracotta-700">
              Well, that wasn&apos;t meant to happen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sage-800">
            <p>
              Something tripped up while loading this page. It&apos;s almost
              certainly us, not you — give it another go and it should sort
              itself out.
            </p>
            {error.digest ? (
              <p className="text-xs text-sage-600">
                Reference: <span className="font-mono">{error.digest}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {retry ? <Button onClick={() => retry()}>Try again</Button> : null}
              <Link href="/dashboard">
                <Button variant="outline">Back to Today</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
