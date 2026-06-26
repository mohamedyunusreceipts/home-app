'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/lib/utils'

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

/**
 * Desktop sidebar nav (≥768px) — full destination list. On mobile (<768px) the
 * floating PillNav + More sheet take over, so this renders nothing there.
 * Focus Timeline redesign — desktop keeps a sidebar.
 */
export function PrimaryNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-1 border-r border-cream-300 bg-cream-100 px-3 pt-8 md:flex"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-terracotta-100 text-terracotta-700'
                : 'text-sage-700 hover:bg-cream-200 hover:text-sage-800',
            )}
          >
            <NavIcon d={item.icon} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
