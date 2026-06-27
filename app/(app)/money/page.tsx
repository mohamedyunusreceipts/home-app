import Link from 'next/link'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { SettleUpButton } from '@/components/money/settle-up-button'
import { ScreenHeader } from '@/components/shell/screen-header'
import { formatZar, formatZarRounded, currentMonthKey } from '@/components/money/format'
import { budgetProgress } from '@/components/money/budget'
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

/** Drill-in rows linking to the existing /money/* sub-routes. */
const DRILL_INS = [
  { href: '/money/expenses', label: 'Split expenses' },
  { href: '/money/bills', label: 'Bills & subscriptions' },
  { href: '/money/savings', label: 'Savings goals' },
  { href: '/money/who-owes-who', label: 'Who owes who' },
  { href: '/money/budget', label: 'Monthly budget' },
]

function Chevron() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C8B79C"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

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
  const monthTotal = monthSpend.reduce((s, e) => s + e.amount, 0)

  // Hero progress: this month's total spend vs the sum of all category limits.
  const budgetTotal = (budgetRows ?? []).reduce((s, b) => s + b.limit_amount, 0)
  const budgetPct = budgetTotal > 0 ? Math.round((monthTotal / budgetTotal) * 100) : 0

  // Who owes who — recomputed live, oriented from the current user's view.
  const balance = computeWhoOwesWho(
    expenses.map((e) => ({ id: e.id, paidByUserId: e.paid_by_user_id, amount: e.amount })),
    splits.map((s) => ({ expenseId: s.expense_id, userId: s.user_id, shareAmount: s.share_amount })),
    members.map((m) => m.userId),
  )
  const settled = balance.amount <= 0 || !balance.debtorUserId || !balance.creditorUserId
  // The "other" member is the partner (the member who isn't the signed-in user).
  const partner = members.find((m) => m.userId !== user.id)
  const partnerName = partner ? partner.name : 'Your partner'
  // Direction relative to "you": creditor === you → partner owes you.
  const partnerOwesYou = !settled && balance.creditorUserId === user.id
  const owesLabel = settled
    ? 'ALL SQUARE'
    : partnerOwesYou
      ? `${displayName(balance.debtorUserId!, members, user.id).toUpperCase()} OWES YOU`
      : `YOU OWE ${displayName(balance.creditorUserId!, members, user.id).toUpperCase()}`
  const owesAmount = settled ? formatZar(0) : formatZar(balance.amount)

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
  const dueTotal = upcoming.reduce((s, u) => s + u.amount, 0)
  const dueCount = upcoming.length

  // Budgets running hot: most-at-risk first, only categories with a real limit.
  const hotRows = progress.filter((p) => p.limit > 0).slice(0, 4)

  return (
    <main className="animate-[fadeIn_250ms_ease] px-[22px] pb-[120px] pt-2">
      <ScreenHeader title="Money" />

      <div className="space-y-4">
        {/* Spent-this-month hero. */}
        <section className="rounded-[22px] bg-sage-700 p-[18px] text-cream-50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sage-200">
            Spent this month
          </p>
          <p className="mt-1.5 break-words font-serif text-[clamp(28px,9vw,38px)] font-semibold leading-none tabular-nums">
            {formatZarRounded(monthTotal)}
          </p>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.18]">
            <div
              className="h-full rounded-full bg-terracotta-300"
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
          <p className="mt-2 text-[13px] font-medium text-sage-200">
            {budgetTotal > 0
              ? `${budgetPct}% of ${formatZarRounded(budgetTotal)}`
              : 'No budget set this month'}
          </p>
        </section>

        {/* Two stat tiles. */}
        <div className="grid grid-cols-2 gap-4">
          {/* Partner owes you — terracotta tile with optimistic Settle up. */}
          <div className="rounded-[18px] border border-terracotta-100 bg-terracotta-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-terracotta-600">
              {owesLabel}
            </p>
            <div className="mt-2.5">
              {settled ? (
                <p className="break-words font-serif text-[clamp(22px,7vw,28px)] font-semibold leading-none tabular-nums text-terracotta-700">
                  {formatZar(0)}
                </p>
              ) : (
                <SettleUpButton amountLabel={owesAmount} partnerName={partnerName} />
              )}
            </div>
          </div>

          {/* Due this week — white tile. */}
          <Link
            href="/money/bills"
            className="block rounded-[18px] border border-cream-300 bg-cream-50 p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sage-600">
              Due this week
            </p>
            <p className="mt-2.5 break-words font-serif text-[clamp(22px,7vw,28px)] font-semibold leading-none tabular-nums text-terracotta-900">
              {formatZarRounded(dueTotal)}
            </p>
            <p className="mt-2 text-[13px] text-sage-600">
              {dueCount === 0 ? 'Nothing due' : `${dueCount} ${dueCount === 1 ? 'bill' : 'bills'}`}
            </p>
          </Link>
        </div>

        {/* Budgets running hot. */}
        <section className="rounded-[18px] border border-cream-300 bg-cream-50 p-[18px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sage-600">
            Budgets running hot
          </p>
          {hotRows.length === 0 ? (
            <p className="mt-3 text-sm text-sage-600">
              No budgets set yet.{' '}
              <Link href="/money/budget" className="font-medium text-terracotta-700 underline">
                Set this month&apos;s budget
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3.5 space-y-3.5">
              {hotRows.map((p) => {
                const hot = p.ratio >= 0.75
                return (
                  <li key={p.category} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-terracotta-900">{p.category}</span>
                      <span className="shrink-0 tabular-nums text-sage-600">
                        {formatZar(p.spent)} / {formatZar(p.limit)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EDE4D4]">
                      <div
                        className={hot ? 'h-full bg-terracotta-400' : 'h-full bg-sage-400'}
                        style={{ width: `${Math.min(100, Math.round(p.ratio * 100))}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Drill-in list. */}
        <nav className="space-y-2.5">
          {DRILL_INS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="flex items-center justify-between rounded-[16px] border border-cream-300 bg-cream-50 px-4 py-3.5"
            >
              <span className="text-sm font-medium text-terracotta-900">{d.label}</span>
              <Chevron />
            </Link>
          ))}
        </nav>

        {/* Bond card — link to the mortgage module. */}
        <Link
          href="/mortgage"
          className="flex items-center justify-between rounded-[18px] border border-terracotta-100 bg-terracotta-50 px-4 py-4"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-terracotta-600">
              Bond tracker
            </p>
            <p className="mt-1 text-sm text-terracotta-900">
              Paid down, ahead of schedule &amp; redraw available
            </p>
          </div>
          <Chevron />
        </Link>
      </div>
    </main>
  )
}
