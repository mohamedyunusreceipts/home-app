import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { TripForm } from '@/components/travel/trip-form'

export default async function NewTripPage() {
  await requireHousehold()

  return (
    <main className="min-h-screen p-8 pb-28">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <Link href="/travel" className="text-sm text-sage-600 hover:text-terracotta-700">
            ← Back to trips
          </Link>
          <h1 className="font-serif text-3xl text-terracotta-700">New trip</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Trip details</CardTitle>
          </CardHeader>
          <CardContent>
            <TripForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
