import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { availableRedraw } from '@/lib/mortgage/engine'
import { Calculators, type CalculatorDefaults } from '@/components/mortgage/calculators'
import {
  toBondConfig,
  toMonthlyStatement,
  type MortgageRow,
  type StatementRow,
} from '@/components/mortgage/map'

export default async function MortgageCalculatorsPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: mortgage } = await supabase
    .from('mortgages')
    .select(
      'id, household_id, lender, account_ref, original_principal, start_date, term_months, contractual_instalment, current_annual_rate, rate_is_prime_linked, prime_delta',
    )
    .eq('household_id', householdId)
    .maybeSingle<MortgageRow>()

  let defaults: CalculatorDefaults = {
    principal: 0,
    annualRate: 0,
    termMonths: 240,
    instalment: 0,
    currentBalance: 0,
    availableRedraw: null,
  }

  if (mortgage) {
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
    const latest = rows[rows.length - 1] ?? null

    let redraw: number | null = null
    if (latest) {
      try {
        redraw = availableRedraw(
          config,
          rows.map(toMonthlyStatement),
          latest.statement_month,
        )
      } catch {
        redraw = null
      }
    }

    defaults = {
      principal: config.originalPrincipal,
      annualRate: config.currentAnnualRate,
      termMonths: config.termMonths,
      instalment: config.contractualInstalment,
      currentBalance: latest?.closing_balance ?? config.originalPrincipal,
      availableRedraw: redraw,
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Calculators</h1>
          <Link href="/mortgage">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        {!mortgage && (
          <p className="text-sage-600">
            These calculators work standalone — but if you set up your bond first,
            they&apos;ll come pre-filled with your figures.{' '}
            <Link href="/mortgage/setup" className="text-terracotta-700 underline">
              Set up your bond
            </Link>
            .
          </p>
        )}

        <Calculators defaults={defaults} />
      </div>
    </main>
  )
}
