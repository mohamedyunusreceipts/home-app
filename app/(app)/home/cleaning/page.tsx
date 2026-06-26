import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { SectionNav } from '@/components/home/section-nav'
import { RecurringItemForm } from '@/components/home/recurring-item-form'
import { RecurringItemList } from '@/components/home/recurring-item-list'
import { fetchHouseholdMembers } from '@/components/home/members'
import type { CleaningTaskRow } from '@/components/home/map'
import { addCleaningTaskAction, completeCleaningTaskAction } from '../actions'

export default async function CleaningPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { members, names } = await fetchHouseholdMembers()

  const { data: rows } = await supabase
    .from('cleaning_tasks')
    .select(
      'id, household_id, name, assignee_user_id, recurrence_rrule, next_due, last_done_at, last_done_by',
    )
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('next_due', { ascending: true, nullsFirst: false })
    .returns<CleaningTaskRow[]>()

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Cleaning schedule</h1>
        <SectionNav active="/home/cleaning" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Add a cleaning task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringItemForm
              action={addCleaningTaskAction}
              nounLabel="Task"
              members={members}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Cleaning tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringItemList
              rows={rows ?? []}
              completeAction={completeCleaningTaskAction}
              memberNames={names}
              emptyText="No cleaning tasks yet. Add your first one above."
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
