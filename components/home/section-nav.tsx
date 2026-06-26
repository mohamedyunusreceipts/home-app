import Link from 'next/link'

export const HOME_SECTIONS = [
  { href: '/home', label: 'Chores' },
  { href: '/home/cleaning', label: 'Cleaning' },
  { href: '/home/maintenance', label: 'Maintenance' },
  { href: '/home/projects', label: 'Projects' },
  { href: '/home/lists', label: 'Shared lists' },
  { href: '/home/shopping', label: 'Shopping links' },
] as const

/**
 * Horizontal tab bar across the Home Management sections (design spec §9.3).
 * `active` is the href of the current section so it can be highlighted.
 */
export function SectionNav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-sage-200 pb-3">
      {HOME_SECTIONS.map((s) => {
        const isActive = s.href === active
        return (
          <Link
            key={s.href}
            href={s.href}
            className={
              isActive
                ? 'rounded-md bg-terracotta-400 px-3 py-1.5 text-sm font-medium text-cream-50'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-sage-700 hover:bg-sage-50'
            }
          >
            {s.label}
          </Link>
        )
      })}
    </nav>
  )
}
