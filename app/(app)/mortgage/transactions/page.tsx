import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/mortgage/stat-card'
import { formatZar } from '@/components/mortgage/format'
import {
  TransactionsList,
  type TransactionListItem,
} from '@/components/mortgage/transactions-list'
import { TransactionForm, type ContributorOption } from './transaction-form'
import type { MortgageRow, TransactionRow } from '@/components/mortgage/map'

type MemberProfile = {
  user_id: string
  profiles: { id: string; display_name: string | null; email: string } | null
}

export default async function MortgageTransactionsPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: mortgage } = await supabase
    .from('mortgages')
    .select('id')
    .eq('household_id', householdId)
    .maybeSingle<Pick<MortgageRow, 'id'>>()

  // No bond yet — warm empty state nudging to setup.
  if (!mortgage) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="font-serif text-3xl text-terracotta-700">Contributions</h1>
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-terracotta-700">
                No bond yet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sage-800">
              <p>
                Set up your bond first, then you can log the extra money you each put in
                or take out.
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

  const [{ data: txRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from('mortgage_transactions')
      .select(
        'id, household_id, mortgage_id, occurred_on, amount, kind, contributed_by_user_id, note',
      )
      .eq('mortgage_id', mortgage.id)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<TransactionRow[]>(),
    supabase
      .from('household_members')
      .select('user_id, profiles ( id, display_name, email )')
      .eq('household_id', householdId)
      .returns<MemberProfile[]>(),
  ])

  const transactions = txRows ?? []
  const members = memberRows ?? []

  // Build a display name for each member. The signed-in user reads as "You".
  function displayNameFor(userId: string): string {
    if (userId === user.id) return 'You'
    const m = members.find((row) => row.user_id === userId)
    return m?.profiles?.display_name || m?.profiles?.email || 'Partner'
  }

  // Contributor options for the form: every household member by name.
  const contributorOptions: ContributorOption[] = members.map((m) => ({
    userId: m.user_id,
    name: displayNameFor(m.user_id),
  }))

  // History items with resolved contributor names.
  const items: TransactionListItem[] = transactions.map((t) => ({
    ...t,
    contributorName:
      t.contributed_by_user_id == null ? null : displayNameFor(t.contributed_by_user_id),
  }))

  // Summary totals.
  const totalDeposited = transactions
    .filter((t) => t.kind === 'extra_deposit')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalWithdrawn = transactions
    .filter((t) => t.kind === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0)
  const netExtraIn = totalDeposited - totalWithdrawn

  // Per-person net (deposits − withdrawals) keyed by contributor; null = Joint.
  const netByContributor = new Map<string | null, number>()
  for (const t of transactions) {
    const key = t.contributed_by_user_id
    const signed = t.kind === 'extra_deposit' ? t.amount : -t.amount
    netByContributor.set(key, (netByContributor.get(key) ?? 0) + signed)
  }

  // Build the per-person breakdown: each member, then Joint.
  const breakdown: { label: string; value: number }[] = [
    ...members.map((m) => ({
      label: displayNameFor(m.user_id),
      value: netByContributor.get(m.user_id) ?? 0,
    })),
    { label: 'Joint', value: netByContributor.get(null) ?? 0 },
  ]

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Contributions</h1>
          <Link href="/mortgage">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        {/* Headline — net extra paid in. */}
        <StatCard
          label="Net extra paid in"
          value={formatZar(netExtraIn)}
          hint="Deposits less withdrawals, across everyone"
          emphasis
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Total extra deposited"
            value={formatZar(totalDeposited)}
            hint="Money put into the bond"
          />
          <StatCard
            label="Total withdrawn"
            value={formatZar(totalWithdrawn)}
            hint="Money taken back out"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Per-person breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              {breakdown.map((b) => (
                <div key={b.label} className="space-y-1">
                  <dt className="text-sm text-sage-600">{b.label}</dt>
                  <dd className="text-xl font-medium text-sage-800">
                    {formatZar(b.value)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-sage-500">
              Net of withdrawals — what each of you has put in on balance.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Log a deposit or withdrawal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionForm members={contributorOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">History</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionsList items={items} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
