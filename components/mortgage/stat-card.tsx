import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type StatCardProps = {
  label: string
  value: string
  hint?: string
  /** Render the value larger — for the headline "available to redraw" figure. */
  emphasis?: boolean
}

/**
 * A small presentational stat card used across the mortgage dashboard.
 * Warm theme: serif terracotta heading, sage body.
 */
export function StatCard({ label, value, hint, emphasis = false }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-terracotta-700">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p
          className={
            emphasis
              ? 'font-serif text-4xl font-semibold text-terracotta-700'
              : 'text-2xl font-medium text-sage-800'
          }
        >
          {value}
        </p>
        {hint && <p className="text-sm text-sage-600">{hint}</p>}
      </CardContent>
    </Card>
  )
}
