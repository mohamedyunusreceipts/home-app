import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Drive folder-path layout (spec §5.4), lazy-created under the household root:
 *
 *   /HomeApp/
 *     /Documents/{IDs,Passports,Warranties,Car,Other}/
 *     /Money/{Receipts,Bills}/
 *     /Food/RecipePhotos/
 *     /Home/{MaintenanceDocs,HomeProjects}/
 *     /Travel/<TripId>-<TripNameSlug>/
 *     /Wardrobe/<UserId>/
 *     /Calendar/Attachments/
 *
 * The pure path-building helpers below have NO dependency on Supabase or the Drive
 * API, so they are unit-testable without mocks. The DB/Drive I/O lives in
 * `resolveFolderId` / `FolderResolver` further down.
 */

export const DRIVE_ROOT = 'HomeApp'

/** Canonical module names as they appear in the Drive path. */
export type DriveModule =
  | 'Documents'
  | 'Money'
  | 'Food'
  | 'Home'
  | 'Travel'
  | 'Wardrobe'
  | 'Calendar'

/**
 * Slugify a free-text name for safe use in a Drive folder segment.
 * Lowercases, strips diacritics, collapses non-alphanumerics to single hyphens,
 * and trims leading/trailing hyphens. Empty input yields 'untitled'.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

/** Join non-empty segments into a canonical `/HomeApp/...` path (no trailing slash). */
function joinPath(...segments: string[]): string {
  const parts = [DRIVE_ROOT, ...segments].filter((s) => s.length > 0)
  return '/' + parts.join('/')
}

// ── Pure path builders, one per module/subcategory in §5.4 ──────────────────

/** Top-level module folder, e.g. `/HomeApp/Money`. */
export function modulePath(module: DriveModule): string {
  return joinPath(module)
}

export const DOCUMENT_SUBCATEGORIES = [
  'IDs',
  'Passports',
  'Warranties',
  'Car',
  'Other',
] as const
export type DocumentSubcategory = (typeof DOCUMENT_SUBCATEGORIES)[number]

/** `/HomeApp/Documents/<Subcategory>` */
export function documentsPath(sub: DocumentSubcategory): string {
  return joinPath('Documents', sub)
}

export const MONEY_SUBCATEGORIES = ['Receipts', 'Bills'] as const
export type MoneySubcategory = (typeof MONEY_SUBCATEGORIES)[number]

/** `/HomeApp/Money/<Subcategory>` */
export function moneyPath(sub: MoneySubcategory): string {
  return joinPath('Money', sub)
}

/** `/HomeApp/Food/RecipePhotos` */
export function foodRecipePhotosPath(): string {
  return joinPath('Food', 'RecipePhotos')
}

export const HOME_SUBCATEGORIES = ['MaintenanceDocs', 'HomeProjects'] as const
export type HomeSubcategory = (typeof HOME_SUBCATEGORIES)[number]

/** `/HomeApp/Home/<Subcategory>` */
export function homePath(sub: HomeSubcategory): string {
  return joinPath('Home', sub)
}

/**
 * `/HomeApp/Travel/<TripId>-<TripNameSlug>` — the TripId prefix prevents
 * collisions when two trips share a name (spec §9.5).
 */
export function travelTripPath(tripId: string, tripName: string): string {
  return joinPath('Travel', `${tripId}-${slugify(tripName)}`)
}

/** `/HomeApp/Wardrobe/<UserId>` — per-user wardrobe folder. */
export function wardrobePath(userId: string): string {
  return joinPath('Wardrobe', userId)
}

/** `/HomeApp/Calendar/Attachments` */
export function calendarAttachmentsPath(): string {
  return joinPath('Calendar', 'Attachments')
}

// ── DB-backed resolver (cache lookup + lazy create) ─────────────────────────

/**
 * Minimal shape of the live Drive client the resolver needs to lazily create
 * folders. Kept as a structural interface so the resolver does not import
 * DriveClient (avoids a cycle — DriveClient uses the resolver).
 */
export interface FolderCreator {
  /**
   * Ensure a folder named `name` exists under `parentId` (or the Drive root when
   * `parentId` is undefined) and return its Drive folder id.
   */
  ensureFolder(name: string, parentId?: string): Promise<string>
}

interface DriveFolderRow {
  drive_folder_id: string
}

/**
 * Look up the cached `drive_folder_id` for a canonical path in `drive_folders`.
 * Returns null when not cached. Pure DB read — no Drive calls.
 */
export async function lookupFolderId(
  supabase: SupabaseClient,
  householdId: string,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('drive_folders')
    .select('drive_folder_id')
    .eq('household_id', householdId)
    .eq('path', path)
    .maybeSingle<DriveFolderRow>()
  if (error || !data) return null
  return data.drive_folder_id
}

/** Cache a resolved (path → drive_folder_id) mapping. Idempotent on conflict. */
export async function cacheFolderId(
  supabase: SupabaseClient,
  householdId: string,
  path: string,
  driveFolderId: string,
): Promise<void> {
  await supabase
    .from('drive_folders')
    .upsert(
      { household_id: householdId, path, drive_folder_id: driveFolderId },
      { onConflict: 'household_id,path' },
    )
}

/**
 * Resolve a canonical Drive path to a `drive_folder_id`, creating missing folders
 * lazily when a live Drive client is supplied.
 *
 * 1. Cache hit → return immediately.
 * 2. Cache miss + no Drive client → null (caller decides; e.g. read-only path).
 * 3. Cache miss + Drive client → walk each segment from the root, creating folders
 *    as needed, caching the final mapping.
 *
 * Each intermediate segment is also cached so sibling lookups are cheap.
 */
export async function resolveFolderId(
  supabase: SupabaseClient,
  householdId: string,
  path: string,
  creator?: FolderCreator,
): Promise<string | null> {
  const cached = await lookupFolderId(supabase, householdId, path)
  if (cached) return cached
  if (!creator) return null

  // Split "/HomeApp/Money/Receipts" → ["HomeApp", "Money", "Receipts"]
  const segments = path.split('/').filter((s) => s.length > 0)

  let parentId: string | undefined = undefined
  let runningPath = ''
  for (const segment of segments) {
    runningPath = `${runningPath}/${segment}`
    const cachedSegment = await lookupFolderId(supabase, householdId, runningPath)
    if (cachedSegment) {
      parentId = cachedSegment
      continue
    }
    const created = await creator.ensureFolder(segment, parentId)
    await cacheFolderId(supabase, householdId, runningPath, created)
    parentId = created
  }

  return parentId ?? null
}
