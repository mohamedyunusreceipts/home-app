import Link from 'next/link'
import { ScreenHeader } from '@/components/shell/screen-header'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { availableRedraw, amortisationSchedule } from '@/lib/mortgage/engine'
import { BalanceChart, type BalancePoint } from '@/components/mortgage/balance-chart'
import { formatZar, formatZarRounded } from '@/components/mortgage/format'
import {
  toBondConfig,
  toMonthlyStatement,
  type MortgageRow,
  type StatementRow,
} from '@/components/mortgage/map'

/** Short "Jun 2026" style month label for the hero subtext (JHB locale). */
const shortMonthFormatter = new Intl.DateTimeFormat('en-ZA', {
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Johannesburg',
})

function shortMonth(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return shortMonthFormatter.format(d)
}

/** Render whole-months ahead as a compact "3 yrs" / "8 mo" / "1 yr 2 mo" label. */
function aheadLabel(months: number): string {
  if (months <= 0) return 'On track'
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years === 0) return `${rem} mo`
  if (rem === 0) return `${years} ${years === 1 ? 'yr' : 'yrs'}`
  return `${years} ${years === 1 ? 'yr' : 'yrs'} ${rem} mo`
}

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

  const editChip = (
    <Link
      href="/mortgage/setup"
      className="inline-flex items-center rounded-full border border-cream-300 bg-cream-50 px-4 py-1.5 text-[13px] font-semibold text-sage-600 transition-colors hover:bg-cream-100"
    >
      Edit
    </Link>
  )

  // Warm empty state — no bond configured yet.
  if (!mortgage) {
    return (
      <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
        <div className="mx-auto max-w-2xl">
          <ScreenHeader title="Bond" />
          <div className="mt-6 rounded-[16px] border border-cream-300 bg-cream-50 px-[18px] py-8 text-center">
            <p className="font-serif text-[18px] font-semibold text-terracotta-900">
              Let&apos;s set up your access bond
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-[#8a7163]">
              Track what you&apos;ve paid down, how far ahead of schedule you are, and
              how much you can redraw — all in one place. Start by capturing your
              bond&apos;s details.
            </p>
            <div className="mt-4 flex justify-center">
              <Link
                href="/mortgage/setup"
                className="inline-flex items-center rounded-full bg-terracotta-400 px-4 py-2 text-[13px] font-semibold text-cream-50 shadow-sm transition-colors hover:bg-terracotta-500"
              >
                Set up your bond
              </Link>
            </div>
          </div>
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

  const lenderLine = [mortgage.lender, latest ? `as at ${shortMonth(latestMonth)}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="min-h-screen px-[22px] pt-2 pb-[120px]">
      <div className="mx-auto max-w-2xl">
        <ScreenHeader title="Bond" action={editChip} />

        {/* Redraw hero — terracotta, white. */}
        <section className="rounded-[22px] bg-[#C77B5C] p-[18px] text-cream-50">
          <p className="text-[11px] font-semibold tracking-[0.07em] text-cream-50/85 uppercase">
            Available to redraw
          </p>
          <p className="mt-2 font-serif text-[42px] leading-none font-semibold">
            {formatZarRounded(redraw)}
          </p>
          <p className="mt-2 text-[13px] text-cream-50/90">
            {latest ? lenderLine : 'Add a statement to calculate your redraw'}
          </p>
        </section>

        {/* Two stat tiles. */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[16px] border border-cream-300 bg-cream-50 px-[18px] py-4">
            <p className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
              Outstanding
            </p>
            <p className="mt-1 font-serif text-[22px] font-semibold text-terracotta-900">
              {formatZar(currentBalance)}
            </p>
          </div>
          <div className="rounded-[16px] border border-cream-300 bg-cream-50 px-[18px] py-4">
            <p className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
              Paid down
            </p>
            <p className="mt-1 font-serif text-[22px] font-semibold text-terracotta-900">
              {formatZar(principalPaidDown)}
            </p>
          </div>
        </div>

        {/* Ahead-of-schedule strip. */}
        <section className="mt-3 flex items-center justify-between gap-4 rounded-[16px] border border-[#DCE7DC] bg-[#F1F5F1] px-[18px] py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
              Ahead of schedule
            </p>
            <p className="mt-0.5 text-[13px] text-sage-600">
              {monthsAhead > 0
                ? 'Paying down faster than plan'
                : 'Keep adding extra to get ahead'}
            </p>
          </div>
          <p className="shrink-0 font-serif text-[26px] font-semibold text-[#3B523C]">
            {aheadLabel(monthsAhead)}
          </p>
        </section>

        {/* Balance vs schedule card. */}
        <section className="mt-3 rounded-[20px] border border-cream-300 bg-cream-50 p-[18px]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
              Balance vs schedule
            </h2>
            <div className="flex items-center gap-3 text-[11px] font-medium text-sage-600">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#95B695]"
                  aria-hidden
                />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#DBCFB7]"
                  aria-hidden
                />
                Plan
              </span>
            </div>
          </div>
          <div className="mt-4">
            <BalanceChart points={chartPoints} />
          </div>
        </section>

        {/* Sub-navigation. */}
        <nav className="mt-3 space-y-2">
          {[
            { href: '/mortgage/statements', label: 'Statements' },
            { href: '/mortgage/transactions', label: 'Contributions' },
            { href: '/mortgage/calculators', label: 'Calculators' },
            { href: '/mortgage/setup', label: 'Bond setup' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between gap-4 rounded-[16px] border border-cream-300 bg-cream-50 px-[18px] py-[14px] transition-colors hover:bg-cream-100"
            >
              <span className="text-[15px] font-semibold text-terracotta-900">
                {item.label}
              </span>
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
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
