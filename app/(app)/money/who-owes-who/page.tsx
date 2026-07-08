import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/money/stat-card'
import { formatZar } from '@/components/money/format'
import { computeOutstanding } from '@/components/money/settlement'
import { resolveMembers, displayName } from '@/components/money/members'
import type {
  ExpenseRow,
  ExpenseSplitRow,
  SettlementRow,
  SettlementPlanRow,
} from '@/components/money/map'
import { SettleUp } from './settle-up'

/** Today as YYYY-MM-DD in the app timezone (Africa/Johannesburg). */
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default async function WhoOwesWhoPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const [
    { data: expenseRows },
    { data: splitRows },
    { data: settlementRows },
    { data: planRows },
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
      .from('settlements')
      .select('id, household_id, from_user_id, to_user_id, amount, note, occurred_on, created_at')
      .eq('household_id', householdId)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<SettlementRow[]>(),
    supabase
      .from('settlement_plans')
      .select('id, household_id, from_user_id, to_user_id, installment_amount, recurrence_rrule, next_due, last_reminded_on, active, created_at, updated_at')
      .eq('household_id', householdId)
      .eq('active', true)
      .returns<SettlementPlanRow[]>(),
    resolveMembers(supabase, householdId),
  ])

  const expenses = expenseRows ?? []
  const splits = splitRows ?? []
  const settlements = settlementRows ?? []
  const plans = planRows ?? []
  const memberIds = members.map((m) => m.userId)

  const balance = computeOutstanding(
    expenses.map((e) => ({ id: e.id, paidByUserId: e.paid_by_user_id, amount: e.amount })),
    splits.map((s) => ({ expenseId: s.expense_id, userId: s.user_id, shareAmount: s.share_amount })),
    settlements.map((s) => ({
      fromUserId: s.from_user_id,
      toUserId: s.to_user_id,
      amount: s.amount,
    })),
    memberIds,
  )

  const square = balance.outstanding <= 0 || !balance.owerId || !balance.owedId
  const headline = square
    ? 'All square ✓'
    : `${displayName(balance.owerId!, members, user.id)} owes ${displayName(
        balance.owedId!,
        members,
        user.id,
      )}`

  // The active plan (if any) is scoped to whoever currently owes.
  const activePlan =
    plans.find((p) => balance.owerId != null && p.from_user_id === balance.owerId) ?? null

  const today = todayKey()

  return (
    <main className="min-h-screen p-8 pb-[120px]">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Who owes who</h1>
          <Link href="/money">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <StatCard
          label={headline}
          value={square ? '—' : formatZar(balance.outstanding)}
          hint="Net of every split expense minus repayments already logged."
          emphasis
        />

        <SettleUp
          currentUserId={user.id}
          members={members}
          owerId={balance.owerId}
          owedId={balance.owedId}
          outstanding={balance.outstanding}
          originalOwed={balance.originalOwed}
          settlements={settlements}
          activePlan={activePlan}
          today={today}
        />
      </div>
    </main>
  )
}
