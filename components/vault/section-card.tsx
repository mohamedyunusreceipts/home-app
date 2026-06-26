import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SectionCardProps = {
  title: string
  description?: string
  /** Optional element rendered top-right (e.g. a count or link). */
  action?: ReactNode
  children: ReactNode
}

/**
 * A titled section wrapper used across the Vault landing page and sub-pages.
 * Warm theme: serif terracotta heading, sage body.
 */
export function SectionCard({ title, description, action, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="font-serif text-terracotta-700">{title}</CardTitle>
          {description && <p className="text-sm text-sage-600">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-3 text-sage-800">{children}</CardContent>
    </Card>
  )
}
