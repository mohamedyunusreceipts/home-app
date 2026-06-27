import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { ExpenseForm } from './expense-form'
import { resolveMembers, displayName } from '@/components/money/members'
import { categoryOptions } from '@/components/money/categories'
import { formatZar, formatDate } from '@/components/money/format'
import type { ExpenseRow } from '@/components/money/map'

const SPLIT_LABEL: Record<string, string> = {
  equal: 'Equal',
  me_only: 'Payer only',
  partner_only: 'Other only',
  custom_amount: 'Custom',
}

export default async function ExpensesPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const [{ data: expenseRows }, members] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, household_id, date, amount, category, paid_by_user_id, split_type, description, receipt_drive_file_id, created_at')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<ExpenseRow[]>(),
    resolveMembers(supabase, householdId),
  ])

  const expenses = expenseRows ?? []
  const existingCategories = expenses.map((e) => e.category)
  const categories = categoryOptions(existingCategories)

  // Today's date (YYYY-MM-DD) in the app timezone for the form default.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
  }).format(new Date())

  return (
    <main className="min-h-screen p-8 pb-[120px]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Split expenses</h1>
          <Link href="/money">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Add an expense</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              members={members}
              currentUserId={user.id}
              categories={categories}
              today={today}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Recent expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-sage-600">
                No expenses yet. Add your first one above — snap a receipt to fill it in for you.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-sage-200 text-sage-600">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Description</th>
                      <th className="py-2 pr-4 font-medium">Category</th>
                      <th className="py-2 pr-4 font-medium">Paid by</th>
                      <th className="py-2 pr-4 font-medium">Split</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-sage-100 text-sage-800 last:border-0"
                      >
                        <td className="py-2 pr-4">{formatDate(e.date)}</td>
                        <td className="py-2 pr-4">{e.description || '—'}</td>
                        <td className="py-2 pr-4">{e.category}</td>
                        <td className="py-2 pr-4">
                          {displayName(e.paid_by_user_id, members, user.id)}
                        </td>
                        <td className="py-2 pr-4">{SPLIT_LABEL[e.split_type] ?? e.split_type}</td>
                        <td className="py-2 pr-4">{formatZar(e.amount)}</td>
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
