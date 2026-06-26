import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/money/stat-card'
import { formatZar } from '@/components/money/format'
import { computeWhoOwesWho } from '@/components/money/balance'
import { resolveMembers, displayName } from '@/components/money/members'
import type { ExpenseRow, ExpenseSplitRow } from '@/components/money/map'

export default async function WhoOwesWhoPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const [{ data: expenseRows }, { data: splitRows }, members] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, household_id, date, amount, category, paid_by_user_id, split_type, description, receipt_drive_file_id, created_at')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .returns<ExpenseRow[]>(),
    supabase
      .from('expense_splits')
      .select('id, household_id, expense_id, user_id, share_amount')
      .eq('household_id', householdId)
      .returns<ExpenseSplitRow[]>(),
    resolveMembers(supabase, householdId),
  ])

  const expenses = expenseRows ?? []
  const splits = splitRows ?? []

  const balance = computeWhoOwesWho(
    expenses.map((e) => ({ id: e.id, paidByUserId: e.paid_by_user_id, amount: e.amount })),
    splits.map((s) => ({ expenseId: s.expense_id, userId: s.user_id, shareAmount: s.share_amount })),
    members.map((m) => m.userId),
  )

  const settled = balance.amount <= 0 || !balance.debtorUserId || !balance.creditorUserId
  const headline = settled
    ? 'All settled up'
    : `${displayName(balance.debtorUserId!, members, user.id)} owes ${displayName(
        balance.creditorUserId!,
        members,
        user.id,
      )}`

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Who owes who</h1>
          <Link href="/money">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <StatCard
          label={headline}
          value={settled ? '—' : formatZar(balance.amount)}
          hint="Computed live from every split expense — nothing is stored."
          emphasis
        />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Each person&apos;s net</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {members.map((m) => {
                const net = balance.netByUser[m.userId] ?? 0
                return (
                  <div key={m.userId} className="space-y-1">
                    <dt className="text-sm text-sage-600">
                      {displayName(m.userId, members, user.id)}
                    </dt>
                    <dd
                      className={
                        net > 0
                          ? 'text-xl font-medium text-sage-800'
                          : net < 0
                            ? 'text-xl font-medium text-terracotta-700'
                            : 'text-xl font-medium text-sage-500'
                      }
                    >
                      {net > 0 ? `is owed ${formatZar(net)}` : net < 0 ? `owes ${formatZar(-net)}` : 'even'}
                    </dd>
                  </div>
                )
              })}
            </dl>
            <p className="mt-4 text-sm text-sage-500">
              Positive means they fronted more than their share of the shared spend; negative means
              they still owe their share back.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
