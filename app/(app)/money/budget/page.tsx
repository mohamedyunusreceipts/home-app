import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { BudgetForm } from './budget-form'
import { budgetProgress } from '@/components/money/budget'
import { categoryOptions } from '@/components/money/categories'
import { formatZar, formatMonth, currentMonthKey } from '@/components/money/format'
import type { BudgetRow, ExpenseRow } from '@/components/money/map'

export default async function BudgetPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const month = currentMonthKey()
  const monthStart = `${month}-01`

  const [{ data: budgetRows }, { data: expenseRows }] = await Promise.all([
    supabase
      .from('budgets')
      .select('id, household_id, month, category, limit_amount')
      .eq('household_id', householdId)
      .eq('month', monthStart)
      .is('deleted_at', null)
      .returns<BudgetRow[]>(),
    supabase
      .from('expenses')
      .select('id, household_id, date, amount, category, paid_by_user_id, split_type, description, receipt_drive_file_id, created_at')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .gte('date', monthStart)
      .returns<ExpenseRow[]>(),
  ])

  const budgets = budgetRows ?? []
  const spend = (expenseRows ?? [])
    .filter((e) => e.date.slice(0, 7) === month)
    .map((e) => ({ category: e.category, amount: e.amount }))

  const progress = budgetProgress(
    budgets.map((b) => ({ category: b.category, limitAmount: b.limit_amount })),
    spend,
  )

  const categories = categoryOptions([
    ...budgets.map((b) => b.category),
    ...spend.map((s) => s.category),
  ])

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-terracotta-700">Monthly budget</h1>
            <p className="text-sage-600">{formatMonth(month)}</p>
          </div>
          <Link href="/money">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Set a category limit</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetForm month={month} categories={categories} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              This month&apos;s progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sage-800">
            {progress.length === 0 ? (
              <p className="text-sage-600">
                No budgets or spending yet this month. Set a category limit above to start tracking.
              </p>
            ) : (
              progress.map((p) => (
                <div key={p.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={p.warning ? 'font-medium text-terracotta-700' : 'font-medium'}>
                      {p.category}
                      {p.over ? ' · over budget' : p.warning ? ' · nearly there' : ''}
                    </span>
                    <span className={p.warning ? 'text-terracotta-700' : 'text-sage-600'}>
                      {formatZar(p.spent)}
                      {p.limit > 0 ? ` / ${formatZar(p.limit)}` : ' (no limit)'}
                    </span>
                  </div>
                  {p.limit > 0 && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sage-100">
                      <div
                        className={
                          p.over
                            ? 'h-full bg-terracotta-600'
                            : p.warning
                              ? 'h-full bg-terracotta-400'
                              : 'h-full bg-sage-400'
                        }
                        style={{ width: `${Math.min(100, Math.round(p.ratio * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
