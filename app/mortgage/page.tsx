import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { availableRedraw, amortisationSchedule } from '@/lib/mortgage/engine'
import { StatCard } from '@/components/mortgage/stat-card'
import { BalanceChart, type BalancePoint } from '@/components/mortgage/balance-chart'
import { formatZar, formatZarRounded, formatMonth } from '@/components/mortgage/format'
import {
  toBondConfig,
  toMonthlyStatement,
  type MortgageRow,
  type StatementRow,
} from '@/components/mortgage/map'

export default async function MortgagePage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: mortgage } = await supabase
    .from('mortgages')
    .select(
      'id, household_id, lender, account_ref, original_principal, start_date, term_months, contractual_instalment, current_annual_rate, rate_is_prime_linked, prime_delta',
    )
    .eq('household_id', householdId)
    .maybeSingle<MortgageRow>()

  // Warm empty state — no bond configured yet.
  if (!mortgage) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="font-serif text-3xl text-terracotta-700">Your bond</h1>
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-terracotta-700">
                Let&apos;s set up your access bond
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sage-800">
              <p>
                Track what you&apos;ve paid down, how far ahead of schedule you are,
                and how much you can redraw — all in one place. Start by capturing
                your bond&apos;s details.
              </p>
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
    .order('statement_month', { ascending: true })
    .returns<StatementRow[]>()

  const rows = statementRows ?? []
  const config = toBondConfig(mortgage)
  const statements = rows.map(toMonthlyStatement)
  const latest = rows[rows.length - 1] ?? null

  // Engine-derived figures (only meaningful once we have at least one statement).
  const latestMonth = latest?.statement_month ?? config.startDate
  const redraw = latest ? availableRedraw(config, statements, latestMonth) : 0
  const currentBalance = latest?.closing_balance ?? config.originalPrincipal
  const totalPaid = rows.reduce((sum, r) => sum + (r.total_paid ?? 0), 0)
  const totalInterest = rows.reduce((sum, r) => sum + r.interest_charged, 0)
  const principalPaidDown = config.originalPrincipal - currentBalance

  // Months ahead of schedule: compare the original amortisation balance for the
  // same elapsed number of months against the actual current balance.
  const schedule = amortisationSchedule(
    config.originalPrincipal,
    config.currentAnnualRate,
    config.termMonths,
    config.contractualInstalment,
  )
  const elapsedMonths = rows.length
  const scheduledBalance = schedule[Math.max(0, elapsedMonths - 1)]?.closingBalance
  let monthsAhead = 0
  if (latest && scheduledBalance != null && currentBalance < scheduledBalance) {
    // Walk forward through the schedule until projected balance drops to the
    // actual balance — that gap is how many months ahead we are.
    for (let i = elapsedMonths; i < schedule.length; i++) {
      if ((schedule[i]?.closingBalance ?? 0) <= currentBalance) {
        monthsAhead = i - (elapsedMonths - 1)
        break
      }
    }
  }

  // Build chart points: actual closing balance vs the original schedule.
  const chartPoints: BalancePoint[] = rows.map((r, i) => ({
    month: r.statement_month,
    actual: r.closing_balance,
    shadow: schedule[i]?.closingBalance ?? config.originalPrincipal,
  }))

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-terracotta-700">Your bond</h1>
            {mortgage.lender && (
              <p className="text-sage-600">
                {mortgage.lender}
                {mortgage.account_ref ? ` · ${mortgage.account_ref}` : ''}
              </p>
            )}
          </div>
          <Link href="/mortgage/setup">
            <Button variant="outline">Edit bond</Button>
          </Link>
        </header>

        {/* Headline — available to redraw. */}
        <StatCard
          label="Available to redraw"
          value={formatZarRounded(redraw)}
          hint={
            latest
              ? `As at ${formatMonth(latestMonth)}`
              : 'Add a statement to calculate your redraw'
          }
          emphasis
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Outstanding balance"
            value={formatZar(currentBalance)}
            hint={latest ? `As at ${formatMonth(latestMonth)}` : 'Opening balance'}
          />
          <StatCard
            label="Principal paid down"
            value={formatZar(principalPaidDown)}
            hint={`of ${formatZarRounded(config.originalPrincipal)} original`}
          />
          <StatCard
            label="Total paid in"
            value={formatZar(totalPaid)}
            hint="Across all captured statements"
          />
          <StatCard
            label="Total interest charged"
            value={formatZar(totalInterest)}
            hint="Across all captured statements"
          />
        </div>

        <StatCard
          label="Ahead of schedule"
          value={
            monthsAhead > 0
              ? `${monthsAhead} ${monthsAhead === 1 ? 'month' : 'months'}`
              : 'On track'
          }
          hint={
            monthsAhead > 0
              ? 'Paying down faster than the original plan'
              : 'Keep adding extra to get ahead'
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Balance vs original schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BalanceChart points={chartPoints} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link href="/mortgage/statements">
            <Button variant="outline">Statements</Button>
          </Link>
          <Link href="/mortgage/calculators">
            <Button variant="outline">Calculators</Button>
          </Link>
          <Link href="/mortgage/setup">
            <Button variant="outline">Bond setup</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
