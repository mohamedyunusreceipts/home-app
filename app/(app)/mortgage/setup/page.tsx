import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { SetupForm, type BondDefaults } from './setup-form'
import type { MortgageRow } from '@/components/mortgage/map'

const emptyDefaults: BondDefaults = {
  lender: '',
  accountRef: '',
  startDate: '',
  originalPrincipal: '',
  termMonths: '',
  contractualInstalment: '',
  currentAnnualRate: '',
  rateIsPrimeLinked: false,
  primeDelta: '',
}

export default async function MortgageSetupPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: mortgage } = await supabase
    .from('mortgages')
    .select(
      'id, household_id, lender, account_ref, original_principal, start_date, term_months, contractual_instalment, current_annual_rate, rate_is_prime_linked, prime_delta',
    )
    .eq('household_id', householdId)
    .maybeSingle<MortgageRow>()

  const defaults: BondDefaults = mortgage
    ? {
        lender: mortgage.lender ?? '',
        accountRef: mortgage.account_ref ?? '',
        // start_date may come back as a full timestamp; trim to YYYY-MM-DD for the date input.
        startDate: mortgage.start_date?.slice(0, 10) ?? '',
        originalPrincipal: String(mortgage.original_principal ?? ''),
        termMonths: String(mortgage.term_months ?? ''),
        contractualInstalment: String(mortgage.contractual_instalment ?? ''),
        currentAnnualRate: String(mortgage.current_annual_rate ?? ''),
        rateIsPrimeLinked: Boolean(mortgage.rate_is_prime_linked),
        primeDelta: mortgage.prime_delta == null ? '' : String(mortgage.prime_delta),
      }
    : emptyDefaults

  return (
    <main className="min-h-screen p-8 pb-[120px]">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">
            {mortgage ? 'Edit your bond' : 'Set up your bond'}
          </h1>
          <Link href="/mortgage">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Bond details</CardTitle>
          </CardHeader>
          <CardContent>
            <SetupForm defaults={defaults} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
