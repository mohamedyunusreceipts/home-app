import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { NewGoalForm, AdjustGoal } from './savings-forms'
import { formatZar, formatDate } from '@/components/money/format'
import type { SavingsGoalRow } from '@/components/money/map'

export default async function SavingsPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: goalRows } = await supabase
    .from('savings_goals')
    .select('id, household_id, name, target, current, deadline, drive_image_id')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .returns<SavingsGoalRow[]>()

  const goals = goalRows ?? []

  return (
    <main className="min-h-screen p-8 pb-[120px]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Savings goals</h1>
          <Link href="/money">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">New goal</CardTitle>
          </CardHeader>
          <CardContent>
            <NewGoalForm />
          </CardContent>
        </Card>

        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sage-600">
              No goals yet. Set one above — a holiday, an emergency fund, anything you&apos;re
              saving towards together.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {goals.map((g) => {
              const ratio = g.target > 0 ? Math.min(1, g.current / g.target) : 0
              const pct = Math.round(ratio * 100)
              return (
                <Card key={g.id}>
                  <CardHeader>
                    <CardTitle className="font-serif text-terracotta-700">{g.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sage-800">
                    <p className="text-2xl font-medium">
                      {formatZar(g.current)}{' '}
                      <span className="text-base text-sage-500">of {formatZar(g.target)}</span>
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sage-100">
                      <div className="h-full bg-sage-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-sm text-sage-600">
                      {pct}% there
                      {g.deadline ? ` · by ${formatDate(g.deadline)}` : ''}
                    </p>
                    <AdjustGoal goalId={g.id} />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
