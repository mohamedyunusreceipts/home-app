// Formatting + label helpers for the Wardrobe module. Copied into
// components/wardrobe to keep the module self-contained (no cross-module imports).

const dateFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Johannesburg',
})

/** Format an ISO date/timestamp for display in ZA locale, e.g. 26 Jun 2026. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFormatter.format(d)
}

/** Title-case a single token, e.g. 'outerwear' -> 'Outerwear'. */
export function titleCase(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export const CATEGORY_LABELS: Record<string, string> = {
  top: 'Top',
  bottom: 'Bottom',
  dress: 'Dress',
  shoes: 'Shoes',
  outerwear: 'Outerwear',
  accessory: 'Accessory',
  underwear: 'Underwear',
}

export const LAUNDRY_LABELS: Record<string, string> = {
  clean: 'Clean',
  worn: 'Worn',
  in_wash: 'In wash',
}
