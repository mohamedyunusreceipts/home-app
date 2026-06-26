// Shared types + category metadata for the Calendar module. Kept inside
// components/calendar to stay within this module's scope.

/** The category discriminator emitted by the v_calendar_* views. */
export type CalendarCategory =
  | 'bills'
  | 'chores'
  | 'meals'
  | 'trips'
  | 'birthdays'
  | 'maintenance'
  | 'manual'

/** A normalised calendar row, matching the v_calendar_all view shape. */
export interface CalendarEventRow {
  household_id: string
  source: string
  source_id: string
  title: string
  start: string
  end: string | null
  all_day: boolean
  category: CalendarCategory
  link: string | null
}

/** A manual calendar_events row. */
export interface ManualEventRow {
  id: string
  household_id: string
  title: string
  start: string
  end: string | null
  all_day: boolean
  location: string | null
  notes: string | null
  color: string | null
  created_by: string | null
}

/** A contacts row (birthdays source). */
export interface ContactRow {
  id: string
  household_id: string
  name: string
  dob: string | null
  relationship: string | null
  gift_ideas_text: string | null
}

export interface CategoryMeta {
  category: CalendarCategory
  label: string
  /** Tailwind utility classes for a coloured dot / chip background. */
  dotClass: string
  chipClass: string
  /** Class applied to an event pill in the grid. */
  pillClass: string
}

// Color coding per spec §9.4: bills=red, chores=blue, meals=orange, trips=purple,
// birthdays=pink, maintenance=brown, manual=user-chosen (defaults shown here).
export const CATEGORY_META: Record<CalendarCategory, CategoryMeta> = {
  bills: {
    category: 'bills',
    label: 'Bills',
    dotClass: 'bg-red-500',
    chipClass: 'data-[on=true]:bg-red-500 data-[on=true]:text-white border-red-300 text-red-700',
    pillClass: 'bg-red-100 text-red-800 border-l-2 border-red-500',
  },
  chores: {
    category: 'chores',
    label: 'Chores',
    dotClass: 'bg-blue-500',
    chipClass: 'data-[on=true]:bg-blue-500 data-[on=true]:text-white border-blue-300 text-blue-700',
    pillClass: 'bg-blue-100 text-blue-800 border-l-2 border-blue-500',
  },
  meals: {
    category: 'meals',
    label: 'Meals',
    dotClass: 'bg-orange-500',
    chipClass:
      'data-[on=true]:bg-orange-500 data-[on=true]:text-white border-orange-300 text-orange-700',
    pillClass: 'bg-orange-100 text-orange-800 border-l-2 border-orange-500',
  },
  trips: {
    category: 'trips',
    label: 'Trips',
    dotClass: 'bg-purple-500',
    chipClass:
      'data-[on=true]:bg-purple-500 data-[on=true]:text-white border-purple-300 text-purple-700',
    pillClass: 'bg-purple-100 text-purple-800 border-l-2 border-purple-500',
  },
  birthdays: {
    category: 'birthdays',
    label: 'Birthdays',
    dotClass: 'bg-pink-500',
    chipClass: 'data-[on=true]:bg-pink-500 data-[on=true]:text-white border-pink-300 text-pink-700',
    pillClass: 'bg-pink-100 text-pink-800 border-l-2 border-pink-500',
  },
  maintenance: {
    category: 'maintenance',
    label: 'Maintenance',
    dotClass: 'bg-amber-800',
    chipClass:
      'data-[on=true]:bg-amber-800 data-[on=true]:text-white border-amber-700 text-amber-800',
    pillClass: 'bg-amber-100 text-amber-900 border-l-2 border-amber-800',
  },
  manual: {
    category: 'manual',
    label: 'Manual',
    dotClass: 'bg-teal-500',
    chipClass: 'data-[on=true]:bg-teal-500 data-[on=true]:text-white border-teal-300 text-teal-700',
    pillClass: 'bg-teal-100 text-teal-800 border-l-2 border-teal-500',
  },
}

export const ALL_CATEGORIES: CalendarCategory[] = [
  'bills',
  'chores',
  'meals',
  'trips',
  'birthdays',
  'maintenance',
  'manual',
]
