import Link from 'next/link'

/**
 * Wardrobe chip tab row (Focus Timeline redesign, README §7).
 *
 * Four chips — Items / Outfits / Laundry / Packing — wired to the existing
 * wardrobe sub-routes. Active chip = sage #7A9B7A / white; inactive chips =
 * #F1F5F1 / #5F8160. The caller passes the active href so the right chip lights.
 *
 * (The remaining wardrobe surfaces — partner, occasions, preferences — are
 * still reachable via their routes; only the four primary chips are shown here
 * to match the redesign.)
 */
const TABS: { href: string; label: string }[] = [
  { href: '/wardrobe', label: 'Items' },
  { href: '/wardrobe/generator', label: 'Outfits' },
  { href: '/wardrobe/laundry', label: 'Laundry' },
  { href: '/wardrobe/packing', label: 'Packing' },
]

export function WardrobeTabs({ active }: { active: string }) {
  return (
    <nav
      className="-mx-[22px] flex gap-2 overflow-x-auto px-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Wardrobe sections"
    >
      {TABS.map((tab) => {
        const isActive = tab.href === active
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors"
            style={
              isActive
                ? { background: '#7A9B7A', color: '#FFFFFF' }
                : { background: '#F1F5F1', color: '#5F8160' }
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
