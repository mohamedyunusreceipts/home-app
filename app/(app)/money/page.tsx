import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/money/stat-card'
import { formatZar, formatZarRounded, formatMonth, currentMonthKey } from '@/components/money/format'
import { budgetProgress, anyBudgetWarning } from '@/components/money/budget'
import { computeWhoOwesWho } from '@/components/money/balance'
import { resolveMembers, displayName } from '@/components/money/members'
import { nextOccurrence } from '@/lib/rrule'
import type {
  ExpenseRow,
  ExpenseSplitRow,
  BillRow,
  SubscriptionRow,
  BudgetRow,
} from '@/components/money/map'

const TABS = [
  { href: '/money/budget', label: 'Monthly budget', blurb: 'Set limits and watch spend per category.' },
  { href: '/money/bills', label: 'Bills & subscriptions', blurb: 'Track what is due and when.' },
  { href: '/money/expenses', label: 'Split expenses', blurb: 'Log spend, split it, snap a receipt.' },
  { href: '/money/savings', label: 'Savings goals', blurb: 'Set targets and track progress.' },
  { href: '/money/who-owes-who', label: 'Who owes who', blurb: 'Your live running balance.' },
]

export default async function MoneyPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()
  const month = currentMonthKey()
  const monthStart = `${month}-01`

  const [
    { data: expenseRows },
    { data: splitRows },
    { data: budgetRows },
    { data: billRows },
    { data: subRows },
    members,
  ] = await Promise.all([
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
    supabase
      .from('budgets')
      .select('id, household_id, month, category, limit_amount')
      .eq('household_id', householdId)
      .eq('month', monthStart)
      .is('deleted_at', null)
      .returns<BudgetRow[]>(),
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
    resolveMembers(supabase, householdId),
  ])

  const expenses = expenseRows ?? []
  const splits = splitRows ?? []

  // Month spend per category (expenses dated within the current month).
  const monthSpend = expenses
    .filter((e) => e.date.slice(0, 7) === month)
    .map((e) => ({ category: e.category, amount: e.amount }))
  const progress = budgetProgress(
    (budgetRows ?? []).map((b) => ({ category: b.category, limitAmount: b.limit_amount })),
    monthSpend,
  )
  const warning = anyBudgetWarning(progress)
  const monthTotal = monthSpend.reduce((s, e) => s + e.amount, 0)

  // Who owes who — recomputed live.
  const balance = computeWhoOwesWho(
    expenses.map((e) => ({ id: e.id, paidByUserId: e.paid_by_user_id, amount: e.amount })),
    splits.map((s) => ({ expenseId: s.expense_id, userId: s.user_id, shareAmount: s.share_amount })),
    members.map((m) => m.userId),
  )

  // Upcoming bills + subscriptions in the next 7 days.
  const now = new Date()
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  function due(rrule: string | null, explicit: string | null): Date | null {
    if (explicit) {
      const d = new Date(explicit)
      if (!Number.isNaN(d.getTime())) return d
    }
    if (rrule) {
      try {
        return nextOccurrence(rrule, now)
      } catch {
        return null
      }
    }
    return null
  }
  const upcoming = [
    ...(billRows ?? []).map((b) => ({ name: b.name, amount: b.amount, when: due(b.recurrence_rrule, b.next_due) })),
    ...(subRows ?? []).map((s) => ({ name: s.name, amount: s.amount, when: due(s.recurrence_rrule, s.next_charge) })),
  ]
    .filter((x) => x.when != null && x.when <= soon)
    .sort((a, b) => (a.when!.getTime() - b.when!.getTime()))
    .slice(0, 3)

  const balanceLine =
    balance.amount <= 0 || !balance.debtorUserId || !balance.creditorUserId
      ? 'All settled up'
      : `${displayName(balance.debtorUserId, members, user.id)} owes ${displayName(
          balance.creditorUserId,
          members,
          user.id,
        )} ${formatZar(balance.amount)}`

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="font-serif text-3xl text-terracotta-700">Money</h1>
          <p className="text-sage-600">{formatMonth(month)} at a glance</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Spent this month"
            value={formatZarRounded(monthTotal)}
            hint={warning ? 'A budget is running hot — check below' : 'Across all categories'}
            emphasis
          />
          <Link href="/money/who-owes-who" className="block">
            <StatCard label="Who owes who" value={balanceLine} hint="Tap to see the breakdown" />
          </Link>
        </div>

        {/* Budget warning card (spec §7 dashboard + §9.1). */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Budget warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sage-800">
            {progress.length === 0 ? (
              <p className="text-sage-600">
                No budgets set yet.{' '}
                <Link href="/money/budget" className="text-terracotta-700 underline">
                  Set this month&apos;s budget
                </Link>
                .
              </p>
            ) : (
              progress
                .filter((p) => p.limit > 0)
                .slice(0, 4)
                .map((p) => (
                  <div key={p.category} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={p.warning ? 'font-medium text-terracotta-700' : ''}>
                        {p.category}
                      </span>
                      <span className={p.warning ? 'text-terracotta-700' : 'text-sage-600'}>
                        {formatZar(p.spent)} / {formatZar(p.limit)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sage-100">
                      <div
                        className={p.over ? 'h-full bg-terracotta-600' : p.warning ? 'h-full bg-terracotta-400' : 'h-full bg-sage-400'}
                        style={{ width: `${Math.min(100, Math.round(p.ratio * 100))}%` }}
                      />
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming bills. */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Due in the next 7 days</CardTitle>
          </CardHeader>
          <CardContent className="text-sage-800">
            {upcoming.length === 0 ? (
              <p className="text-sage-600">Nothing due this week.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {upcoming.map((u, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{u.name}</span>
                    <span className="text-sage-600">{formatZar(u.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Tab navigation cards. */}
        <div className="grid gap-4 sm:grid-cols-2">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="block">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-lg text-terracotta-700">{t.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-sage-600">{t.blurb}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Bond tracker — kept as a clear card/link (mortgage module). */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Bond tracker</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sage-700">
            <p className="text-sm">
              Track your access bond — what you&apos;ve paid down, how far ahead of schedule you
              are, and how much you can redraw.
            </p>
            <Link href="/mortgage">
              <Button className="self-start">Open bond tracker</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
