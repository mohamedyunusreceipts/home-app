import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Warm "coming soon" empty state for not-yet-built module routes, so the
 * primary nav never 404s.
 */
export function ComingSoon({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <main className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">{title}</h1>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Coming soon</CardTitle>
          </CardHeader>
          <CardContent className="text-sage-700">
            <p>{description}</p>
          </CardContent>
        </Card>
        {children}
      </div>
    </main>
  )
}
