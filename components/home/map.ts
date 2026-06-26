// Row types for the Home Management module (snake_case as returned by supabase)
// and pure tick-off logic. Kept inside components/home to stay within the
// module's scope (no cross-module imports, per design spec §3.2).

import { nextOccurrence } from '@/lib/rrule'

/** A single checklist item inside a shared_lists.items jsonb array. */
export type SharedListItem = {
  text: string
  checked: boolean
}

/** Shape of a `chores` row. */
export type ChoreRow = {
  id: string
  household_id: string
  name: string
  assignee_user_id: string | null
  recurrence_rrule: string | null
  next_due: string | null
  last_done_at: string | null
  last_done_by: string | null
}

/** Shape of a `cleaning_tasks` row — identical columns to chores by design. */
export type CleaningTaskRow = ChoreRow

/** Shape of a `maintenance_reminders` row. */
export type MaintenanceReminderRow = {
  id: string
  household_id: string
  item: string
  next_due: string | null
  recurrence_rrule: string | null
  notes: string | null
  attachment_drive_file_id: string | null
  last_done_at: string | null
  last_done_by: string | null
}

/** Status values for a home_projects row. */
export type ProjectStatus = 'idea' | 'planning' | 'in_progress' | 'done'

/** Shape of a `home_projects` row. */
export type HomeProjectRow = {
  id: string
  household_id: string
  name: string
  status: ProjectStatus
  budget: number | null
  notes_md: string | null
  photo_drive_file_ids: string[]
}

/** Shape of a `shared_lists` row. */
export type SharedListRow = {
  id: string
  household_id: string
  name: string
  items: SharedListItem[]
}

/** Shape of a `shopping_links` row. */
export type ShoppingLinkRow = {
  id: string
  household_id: string
  label: string
  url: string
  category: string | null
  notes: string | null
}

/** The DB patch produced when a recurring item is ticked off. */
export type TickOffPatch = {
  last_done_at: string
  last_done_by: string | null
  /** ISO date (YYYY-MM-DD) of the next occurrence, or null when non-recurring. */
  next_due: string | null
}

/**
 * Pure tick-off computation shared by chores, cleaning_tasks and
 * maintenance_reminders (design spec §9.3). Stamps the "done" timestamp and the
 * actor, and — when the item carries an RRULE — advances next_due to the next
 * occurrence strictly after `now` via lib/rrule.
 *
 * Returns only the column patch; the caller is responsible for persistence and
 * for scoping the update to the household. Never throws on a bad rule: an
 * unparseable RRULE leaves next_due null rather than blocking the tick-off.
 */
export function computeTickOff(
  recurrenceRrule: string | null | undefined,
  userId: string | null,
  now: Date = new Date(),
): TickOffPatch {
  let nextDue: string | null = null
  if (recurrenceRrule && recurrenceRrule.trim() !== '') {
    try {
      const next = nextOccurrence(recurrenceRrule, now)
      if (next) {
        // next_due is a date-only column; take the UTC calendar date (lib/rrule
        // returns occurrence components as UTC wall-clock — see its module docs).
        nextDue = next.toISOString().slice(0, 10)
      }
    } catch {
      nextDue = null
    }
  }
  return {
    last_done_at: now.toISOString(),
    last_done_by: userId,
    next_due: nextDue,
  }
}
