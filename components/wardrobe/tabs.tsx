import Link from 'next/link'

/**
 * Wardrobe tab bar (spec §9.6 tabs). Server component — the caller passes the
 * currently active href so the active tab is highlighted.
 */
const TABS: { href: string; label: string }[] = [
  { href: '/wardrobe', label: 'My wardrobe' },
  { href: '/wardrobe/partner', label: 'Partner wardrobe' },
  { href: '/wardrobe/generator', label: 'Outfit generator' },
  { href: '/wardrobe/occasions', label: 'Occasion outfits' },
  { href: '/wardrobe/laundry', label: 'Laundry-aware' },
  { href: '/wardrobe/packing', label: 'Packing outfits' },
  { href: '/wardrobe/preferences', label: 'Sizes & preferences' },
]

export function WardrobeTabs({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Wardrobe sections">
      {TABS.map((tab) => {
        const isActive = tab.href === active
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'rounded-full bg-terracotta-600 px-3 py-1.5 text-sm font-medium text-cream-50'
                : 'rounded-full border border-sage-300 px-3 py-1.5 text-sm font-medium text-sage-700 hover:bg-sage-100'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
