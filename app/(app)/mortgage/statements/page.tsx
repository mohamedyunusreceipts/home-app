import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { StatementForm } from './statement-form'
import { formatZar, formatMonth, formatRate } from '@/components/mortgage/format'
import type { MortgageRow, StatementRow } from '@/components/mortgage/map'

export default async function MortgageStatementsPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: mortgage } = await supabase
    .from('mortgages')
    .select('id, current_annual_rate')
    .eq('household_id', householdId)
    .maybeSingle<Pick<MortgageRow, 'id' | 'current_annual_rate'>>()

  // No bond yet — nudge to setup.
  if (!mortgage) {
    return (
      <main className="min-h-screen p-8 pb-[120px]">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="font-serif text-3xl text-terracotta-700">Statements</h1>
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-terracotta-700">
                No bond yet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sage-800">
              <p>Set up your bond first, then you can start capturing statements.</p>
              <Link href="/mortgage/setup">
                <Button>Set up your bond</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  const { data: statementRows } = await supabase
    .from('mortgage_statements')
    .select(
      'id, household_id, mortgage_id, statement_month, closing_balance, interest_charged, annual_rate, total_paid, note',
    )
    .eq('mortgage_id', mortgage.id)
    .order('statement_month', { ascending: false })
    .returns<StatementRow[]>()

  const rows = statementRows ?? []

  return (
    <main className="min-h-screen p-8 pb-[120px]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Statements</h1>
          <Link href="/mortgage">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Add a statement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatementForm defaultRate={String(mortgage.current_annual_rate ?? '')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">History</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sage-600">
                No statements captured yet. Add your first one above to start tracking.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-sage-200 text-sage-600">
                      <th className="py-2 pr-4 font-medium">Month</th>
                      <th className="py-2 pr-4 font-medium">Closing balance</th>
                      <th className="py-2 pr-4 font-medium">Interest</th>
                      <th className="py-2 pr-4 font-medium">Rate</th>
                      <th className="py-2 pr-4 font-medium">Total paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-sage-100 text-sage-800 last:border-0"
                      >
                        <td className="py-2 pr-4">{formatMonth(r.statement_month)}</td>
                        <td className="py-2 pr-4">{formatZar(r.closing_balance)}</td>
                        <td className="py-2 pr-4">{formatZar(r.interest_charged)}</td>
                        <td className="py-2 pr-4">{formatRate(r.annual_rate)}</td>
                        <td className="py-2 pr-4">{formatZar(r.total_paid)}</td>
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
