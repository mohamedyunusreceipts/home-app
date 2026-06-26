import Link from 'next/link'

/** The Food module's tabs (spec §9.2). */
export const FOOD_TABS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/food', label: 'Meal plan' },
  { href: '/food/recipes', label: 'Recipes' },
  { href: '/food/grocery', label: 'Grocery list' },
  { href: '/food/pantry', label: 'Pantry' },
  { href: '/food/budget', label: 'Budget meals' },
  { href: '/food/leftovers', label: 'Leftovers' },
]

/** Horizontal tab strip; the active tab is passed in by each page. */
export function FoodTabs({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Food sections">
      {FOOD_TABS.map((tab) => {
        const isActive = tab.href === active
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'rounded-lg bg-terracotta-400 px-3 py-1.5 text-sm font-medium text-cream-50'
                : 'rounded-lg border border-sage-300 px-3 py-1.5 text-sm font-medium text-sage-800 hover:bg-sage-50'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
