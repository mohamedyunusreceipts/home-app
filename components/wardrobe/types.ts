// DB row shapes for the Wardrobe module (snake_case), and a mapper into the
// pure generator's GenItem shape. Kept inside components/wardrobe so the module
// stays self-contained.

import type { GenItem } from './outfit-gen'

export const WARDROBE_CATEGORIES = [
  'top',
  'bottom',
  'dress',
  'shoes',
  'outerwear',
  'accessory',
  'underwear',
] as const
export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number]

export const LAUNDRY_STATUSES = ['clean', 'worn', 'in_wash'] as const
export type LaundryStatus = (typeof LAUNDRY_STATUSES)[number]

/** Shape of a `wardrobe_items` row as returned from supabase. */
export type WardrobeItemRow = {
  id: string
  household_id: string
  owner_user_id: string
  category: WardrobeCategory
  color: string | null
  season: string[]
  occasion: string[]
  photo_drive_file_id: string | null
  brand: string | null
  size: string | null
  notes: string | null
  laundry_status: LaundryStatus
  visible_to_partner: boolean
  created_at: string
  updated_at: string
}

/** Shape of an `outfits` row as returned from supabase. */
export type OutfitRow = {
  id: string
  household_id: string
  owner_user_id: string
  name: string
  occasion: string | null
  item_ids: string[]
  saved_at: string
  photo_drive_file_id: string | null
}

/** Shape of a `wardrobe_preferences` row as returned from supabase. */
export type WardrobePreferencesRow = {
  user_id: string
  sizes: Record<string, unknown>
  style_notes_md: string | null
}

/** Map a `wardrobe_items` DB row into the generator's GenItem shape. */
export function toGenItem(row: WardrobeItemRow): GenItem {
  return {
    id: row.id,
    category: row.category,
    season: row.season,
    occasion: row.occasion,
    laundryStatus: row.laundry_status,
  }
}

/** Columns selected for a wardrobe_items row (kept in one place). */
export const ITEM_COLUMNS =
  'id, household_id, owner_user_id, category, color, season, occasion, photo_drive_file_id, brand, size, notes, laundry_status, visible_to_partner, created_at, updated_at'

export const OUTFIT_COLUMNS =
  'id, household_id, owner_user_id, name, occasion, item_ids, saved_at, photo_drive_file_id'
