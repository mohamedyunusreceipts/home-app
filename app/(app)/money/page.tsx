import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ComingSoon } from '@/components/shell/coming-soon'

export default function MoneyPage() {
  return (
    <ComingSoon
      title="Money"
      description="Budgets, bills & subscriptions, split expenses, savings goals and who-owes-who — all in one place. Snap a receipt and we'll fill in the details."
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700">Bond tracker</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sage-700">
          <p className="text-sm">
            Your access bond is ready to use now — track what you&apos;ve paid down,
            how far ahead of schedule you are, and how much you can redraw.
          </p>
          <Link href="/mortgage">
            <Button className="self-start">Open bond tracker</Button>
          </Link>
        </CardContent>
      </Card>
    </ComingSoon>
  )
}
