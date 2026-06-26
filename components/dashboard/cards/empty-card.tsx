import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Reusable dashboard card empty state. Modules will later swap these for
 * components that fetch their own data slice (spec §7), keeping the same shell.
 */
export function EmptyCard({
  title,
  message,
  href,
  cta,
}: {
  title: string
  message: string
  href: string
  cta: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-terracotta-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sage-700">
        <p className="text-sm">{message}</p>
        <Link
          href={href}
          className="text-sm font-medium text-terracotta-600 hover:text-terracotta-700"
        >
          {cta} &rarr;
        </Link>
      </CardContent>
    </Card>
  )
}
