import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { sendPushToUser } from '@/lib/notifications/push'
import { createNotification } from '@/lib/notifications'
import { nextOccurrence } from '@/lib/rrule'
import { computeOutstanding, type SettlementRow } from '@/components/money/settlement'
import { resolveMembers, displayName } from '@/components/money/members'
import { formatZar } from '@/components/money/format'
import type { ExpenseRow, ExpenseSplitRow, SettlementRow as SettlementDbRow } from '@/components/money/map'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * POST|GET /api/cron/settlements — installment reminders to the ower.
 *
 * Meant to be hit every ~15 min (installments are daily-grain — see
 * docs/settlement-cron.md). Auth is the shared CRON_SECRET, same as the salaah
 * cron. For each active plan whose `next_due <= today` and that hasn't been
 * reminded today, it pushes a reminder to the ower, stamps `last_reminded_on`,
 * and advances `next_due` via the plan's RRULE. If the balance is already
 * settled it deactivates the plan instead. Per-plan try/catch so one bad plan
 * never 500s the whole job. Returns { checked, sent }.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PlanRow {
  id: string
  household_id: string
  from_user_id: string
  to_user_id: string
  installment_amount: number
  recurrence_rrule: string
  next_due: string
  last_reminded_on: string | null
}

/** YYYY-MM-DD for `date` in the app timezone (Africa/Johannesburg). */
function todayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Current outstanding for a household, folding settlements into the split debt. */
async function outstandingFor(supabase: SupabaseClient, householdId: string) {
  const [{ data: expenseRows }, { data: splitRows }, { data: settlementRows }, members] =
    await Promise.all([
      supabase
        .from('expenses')
        .select('id, paid_by_user_id, amount')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .returns<Pick<ExpenseRow, 'id' | 'paid_by_user_id' | 'amount'>[]>(),
      supabase
        .from('expense_splits')
        .select('expense_id, user_id, share_amount')
        .eq('household_id', householdId)
        .returns<Pick<ExpenseSplitRow, 'expense_id' | 'user_id' | 'share_amount'>[]>(),
      supabase
        .from('settlements')
        .select('from_user_id, to_user_id, amount')
        .eq('household_id', householdId)
        .returns<Pick<SettlementDbRow, 'from_user_id' | 'to_user_id' | 'amount'>[]>(),
      resolveMembers(supabase, householdId),
    ])

  const settlements: SettlementRow[] = (settlementRows ?? []).map((s) => ({
    fromUserId: s.from_user_id,
    toUserId: s.to_user_id,
    amount: s.amount,
  }))

  const balance = computeOutstanding(
    (expenseRows ?? []).map((e) => ({ id: e.id, paidByUserId: e.paid_by_user_id, amount: e.amount })),
    (splitRows ?? []).map((s) => ({
      expenseId: s.expense_id,
      userId: s.user_id,
      shareAmount: s.share_amount,
    })),
    settlements,
    members.map((m) => m.userId),
  )
  return { balance, members }
}

async function handle(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = new Date()
  const today = todayKey(now)

  // Due, un-reminded-today, active plans.
  const { data: plans, error } = await supabase
    .from('settlement_plans')
    .select('id, household_id, from_user_id, to_user_id, installment_amount, recurrence_rrule, next_due, last_reminded_on')
    .eq('active', true)
    .lte('next_due', today)
    .returns<PlanRow[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let checked = 0
  let sent = 0

  for (const plan of plans ?? []) {
    checked += 1
    try {
      // Skip plans already reminded today (idempotent for the 15-min cadence).
      if (plan.last_reminded_on === today) continue

      const { balance, members } = await outstandingFor(supabase, plan.household_id)

      // If the household is square (or the debt flipped), the plan is done.
      if (
        balance.outstanding <= 0 ||
        balance.owerId == null ||
        balance.owerId !== plan.from_user_id
      ) {
        await supabase
          .from('settlement_plans')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', plan.id)
        continue
      }

      const partnerName = displayName(plan.to_user_id, members)
      const body = `Reminder: ${formatZar(plan.installment_amount)} repayment to ${partnerName} is due.`

      await sendPushToUser(supabase, plan.from_user_id, {
        title: 'Repayment due',
        body,
        link: '/money/who-owes-who',
        tag: `settlement-plan-${plan.id}-${today}`,
      })
      await createNotification(supabase, {
        householdId: plan.household_id,
        userId: plan.from_user_id,
        kind: 'settlement',
        title: 'Repayment due',
        body,
        link: '/money/who-owes-who',
      })

      // Advance next_due past today via the plan's RRULE, and stamp the reminder.
      const next = nextOccurrence(plan.recurrence_rrule, now)
      const nextDue = next ? todayKey(next) : plan.next_due
      await supabase
        .from('settlement_plans')
        .update({
          last_reminded_on: today,
          next_due: nextDue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plan.id)

      sent += 1
    } catch (planErr) {
      console.error('[cron/settlements] plan failed:', plan.id, planErr)
    }
  }

  return NextResponse.json({ checked, sent })
}

export async function POST(request: NextRequest): Promise<Response> {
  return handle(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return handle(request)
}
