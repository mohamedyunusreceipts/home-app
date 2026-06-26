// Row shapes for the travel module: `trips` and children as returned by supabase.
// Kept inside components/travel to stay within the module's scope.

export type TripStatus = 'idea' | 'planning' | 'booked' | 'completed'

export const TRIP_STATUSES: readonly TripStatus[] = [
  'idea',
  'planning',
  'booked',
  'completed',
]

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  idea: 'Ideas',
  planning: 'Planning',
  booked: 'Booked',
  completed: 'Completed',
}

export type TripRow = {
  id: string
  household_id: string
  name: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  status: TripStatus
  budget_total: number | null
  cover_image_drive_file_id: string | null
}

export type ItineraryItemRow = {
  id: string
  trip_id: string
  day: string
  time: string | null
  title: string
  location: string | null
  notes: string | null
  attachment_drive_file_id: string | null
}

export type TripExpenseRow = {
  id: string
  trip_id: string
  date: string
  amount: number
  category: string | null
  description: string | null
  also_count_in_monthly_budget: boolean
}

export type PackingListRow = {
  id: string
  trip_id: string
  name: string
}

export type PackingItemRow = {
  id: string
  list_id: string
  name: string
  packed_by_user_id: string | null
  packed: boolean
}

export type TripDocKind =
  | 'passport'
  | 'visa'
  | 'ticket'
  | 'booking'
  | 'insurance'
  | 'other'

export const TRIP_DOC_KINDS: readonly TripDocKind[] = [
  'passport',
  'visa',
  'ticket',
  'booking',
  'insurance',
  'other',
]

export type TripDocRow = {
  id: string
  trip_id: string
  kind: TripDocKind
  drive_file_id: string | null
  expiry_date: string | null
}

export type TripNoteRow = {
  id: string
  trip_id: string
  body_md: string
}

export type TripOutfitRow = {
  id: string
  trip_id: string
  day: string
  wardrobe_item_ids: string[]
}
