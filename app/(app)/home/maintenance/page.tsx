import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { describeRrule } from '@/lib/rrule'
import { SectionNav } from '@/components/home/section-nav'
import { MaintenanceForm } from '@/components/home/maintenance-form'
import { TickOffButton } from '@/components/home/tick-off-button'
import { fetchHouseholdMembers } from '@/components/home/members'
import { describeDue, formatDateTime } from '@/components/home/format'
import type { MaintenanceReminderRow } from '@/components/home/map'
import { addMaintenanceReminderAction, completeMaintenanceReminderAction } from '../actions'

function safeDescribe(rrule: string | null): string | null {
  if (!rrule) return null
  try {
    return describeRrule(rrule)
  } catch {
    return null
  }
}

export default async function MaintenancePage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { names } = await fetchHouseholdMembers()

  const { data: rows } = await supabase
    .from('maintenance_reminders')
    .select(
      'id, household_id, item, next_due, recurrence_rrule, notes, attachment_drive_file_id, last_done_at, last_done_by',
    )
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('next_due', { ascending: true, nullsFirst: false })
    .returns<MaintenanceReminderRow[]>()

  const reminders = rows ?? []

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Maintenance reminders</h1>
        <SectionNav active="/home/maintenance" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Add a reminder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MaintenanceForm action={addMaintenanceReminderAction} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            {reminders.length === 0 ? (
              <p className="text-sage-600">
                No maintenance reminders yet. Add your first one above.
              </p>
            ) : (
              <ul className="space-y-3">
                {reminders.map((r) => {
                  const recurrence = safeDescribe(r.recurrence_rrule)
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sage-200 bg-cream-50 px-4 py-3"
                    >
                      <div className="space-y-0.5">
                        <p className="font-medium text-sage-900">{r.item}</p>
                        <p className="text-sm text-sage-600">
                          {describeDue(r.next_due)}
                          {recurrence ? ` · repeats ${recurrence}` : ''}
                        </p>
                        {r.notes && <p className="text-sm text-sage-600">{r.notes}</p>}
                        {r.last_done_at && (
                          <p className="text-xs text-sage-500">
                            Last done {formatDateTime(r.last_done_at)}
                            {r.last_done_by
                              ? ` by ${names[r.last_done_by] ?? 'someone'}`
                              : ''}
                          </p>
                        )}
                      </div>
                      <TickOffButton
                        id={r.id}
                        action={completeMaintenanceReminderAction}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
