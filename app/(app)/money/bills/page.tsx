import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { BillForm, SubscriptionForm } from './bill-forms'
import { categoryOptions } from '@/components/money/categories'
import { formatZar, formatDate } from '@/components/money/format'
import { nextOccurrence, describeRrule } from '@/lib/rrule'
import type { BillRow, SubscriptionRow } from '@/components/money/map'

/** Resolve the effective next date: explicit date wins, else compute from RRULE. */
function effectiveNext(explicit: string | null, rrule: string | null): string | null {
  if (explicit) return explicit
  if (rrule) {
    try {
      const next = nextOccurrence(rrule, new Date())
      return next ? next.toISOString().slice(0, 10) : null
    } catch {
      return null
    }
  }
  return null
}

function recurrenceLabel(rrule: string | null): string {
  if (!rrule) return 'One-off'
  try {
    return describeRrule(rrule)
  } catch {
    return 'Recurring'
  }
}

export default async function BillsPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const [{ data: billRows }, { data: subRows }] = await Promise.all([
    supabase
      .from('bills')
      .select('id, household_id, name, amount, recurrence_rrule, next_due, category, auto_pay')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .returns<BillRow[]>(),
    supabase
      .from('subscriptions')
      .select('id, household_id, name, amount, recurrence_rrule, next_charge, category, cancel_url')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .returns<SubscriptionRow[]>(),
  ])

  const bills = billRows ?? []
  const subs = subRows ?? []
  const categories = categoryOptions([
    ...bills.map((b) => b.category ?? ''),
    ...subs.map((s) => s.category ?? ''),
  ])

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Bills &amp; subscriptions</h1>
          <Link href="/money">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Add a bill</CardTitle>
          </CardHeader>
          <CardContent>
            <BillForm categories={categories} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Your bills</CardTitle>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <p className="text-sage-600">No bills yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-sage-200 text-sage-600">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Next due</th>
                      <th className="py-2 pr-4 font-medium">Repeats</th>
                      <th className="py-2 pr-4 font-medium">Auto-pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b) => (
                      <tr key={b.id} className="border-b border-sage-100 text-sage-800 last:border-0">
                        <td className="py-2 pr-4">{b.name}</td>
                        <td className="py-2 pr-4">{formatZar(b.amount)}</td>
                        <td className="py-2 pr-4">{formatDate(effectiveNext(b.next_due, b.recurrence_rrule))}</td>
                        <td className="py-2 pr-4">{recurrenceLabel(b.recurrence_rrule)}</td>
                        <td className="py-2 pr-4">{b.auto_pay ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Add a subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <SubscriptionForm categories={categories} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Your subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {subs.length === 0 ? (
              <p className="text-sage-600">No subscriptions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-sage-200 text-sage-600">
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Next charge</th>
                      <th className="py-2 pr-4 font-medium">Repeats</th>
                      <th className="py-2 pr-4 font-medium">Cancel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s) => (
                      <tr key={s.id} className="border-b border-sage-100 text-sage-800 last:border-0">
                        <td className="py-2 pr-4">{s.name}</td>
                        <td className="py-2 pr-4">{formatZar(s.amount)}</td>
                        <td className="py-2 pr-4">{formatDate(effectiveNext(s.next_charge, s.recurrence_rrule))}</td>
                        <td className="py-2 pr-4">{recurrenceLabel(s.recurrence_rrule)}</td>
                        <td className="py-2 pr-4">
                          {s.cancel_url ? (
                            <a href={s.cancel_url} target="_blank" rel="noopener noreferrer" className="text-terracotta-700 underline">
                              Link
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
