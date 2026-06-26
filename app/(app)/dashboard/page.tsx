import { requireHousehold } from '@/lib/auth/redirects'
import {
  TodaysMealsCard,
  UpcomingBillsCard,
  ChoresDueCard,
  CalendarEventsCard,
  GroceryRemindersCard,
  TripCountdownCard,
  BudgetWarningCard,
  MaintenanceRemindersCard,
  BondCard,
} from '@/components/dashboard/cards'

/**
 * Dashboard — single column on mobile, 2-column grid on desktop (spec §7).
 * Module tables don't exist yet, so every card renders an empty state with a
 * link to its module rather than a data query.
 */
export default async function DashboardPage() {
  // Auth-gated by the (app) layout too, but keep the guard so the page is
  // safe in isolation.
  await requireHousehold()

  return (
    <main className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Today</h1>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TodaysMealsCard />
          <UpcomingBillsCard />
          <ChoresDueCard />
          <CalendarEventsCard />
          <GroceryRemindersCard />
          <TripCountdownCard />
          <BudgetWarningCard />
          <MaintenanceRemindersCard />
          <BondCard />
        </div>
      </div>
    </main>
  )
}
