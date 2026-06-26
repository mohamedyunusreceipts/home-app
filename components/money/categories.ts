// Seeded default expense/budget categories (design spec §9.1).
//
// CATEGORIES DECISION: v1 keeps categories as a free-text column on each money
// row, with this seeded list living in code rather than a `categories` table.
// Rationale: a single fixed couple, a short stable list, and no per-category
// metadata to store make a table overkill. Because the DB column is plain text,
// a household can already enter a bespoke category; a categories table can be
// added later without migrating existing rows. UI dropdowns offer this list plus
// whatever custom values already appear in the data.

export const DEFAULT_CATEGORIES = [
  'Groceries',
  'Dining',
  'Transport',
  'Utilities',
  'Rent',
  'Entertainment',
  'Personal',
  'Other',
] as const

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number]

/**
 * Merge the seeded defaults with any custom categories already present in the
 * household's data, de-duplicated and stable-ordered (defaults first, then any
 * extras in first-seen order). Used to populate category dropdowns.
 */
export function categoryOptions(existing: readonly string[] = []): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of [...DEFAULT_CATEGORIES, ...existing]) {
    const trimmed = c.trim()
    if (trimmed === '' || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}
