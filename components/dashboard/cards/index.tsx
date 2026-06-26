import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyCard } from './empty-card'

// One component per dashboard card (spec §7). Each is an empty state for now;
// modules later replace the body with a real data slice without touching the
// dashboard page. Each card lives behind its own export so the swap is local.

export function TodaysMealsCard() {
  return (
    <EmptyCard
      title="Today's meals"
      message="No meals planned yet — plan breakfast, lunch and dinner."
      href="/food"
      cta="Plan meals"
    />
  )
}

export function UpcomingBillsCard() {
  return (
    <EmptyCard
      title="Upcoming bills"
      message="No bills due in the next week. Add your recurring bills to stay ahead."
      href="/money"
      cta="Add a bill"
    />
  )
}

export function ChoresDueCard() {
  return (
    <EmptyCard
      title="Chores due"
      message="Nothing due today. Set up your shared chores and split them fairly."
      href="/home"
      cta="Add chores"
    />
  )
}

export function CalendarEventsCard() {
  return (
    <EmptyCard
      title="Calendar"
      message="No events today or tomorrow. Add appointments and special dates."
      href="/calendar"
      cta="Open calendar"
    />
  )
}

export function GroceryRemindersCard() {
  return (
    <EmptyCard
      title="Grocery list"
      message="Your grocery list is empty — build one from this week's meals."
      href="/food"
      cta="Start a list"
    />
  )
}

export function TripCountdownCard() {
  return (
    <EmptyCard
      title="Trip countdown"
      message="No trips on the horizon yet. Start planning your next getaway."
      href="/travel"
      cta="Plan a trip"
    />
  )
}

export function BudgetWarningCard() {
  return (
    <EmptyCard
      title="Budget"
      message="No budgets set this month. Add category limits to track your spending."
      href="/money"
      cta="Set a budget"
    />
  )
}

export function MaintenanceRemindersCard() {
  return (
    <EmptyCard
      title="Maintenance reminders"
      message="Nothing due in the next 30 days. Add reminders for upkeep and renewals."
      href="/home"
      cta="Add a reminder"
    />
  )
}

/**
 * Bond card — links to the one built Money feature. Simple CTA, no live query.
 */
export function BondCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-terracotta-700">Your bond</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sage-700">
        <p className="text-sm">
          Track what you&apos;ve paid down, how far ahead of schedule you are, and
          how much you can redraw.
        </p>
        <Link href="/mortgage">
          <Button variant="outline" className="self-start">
            Open bond tracker
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
