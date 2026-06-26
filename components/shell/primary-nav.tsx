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
 * Primary navigation — bottom tab bar on mobile (<768px), left sidebar on
 * desktop (≥768px). Spec §6.
 */
export function PrimaryNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-1 border-r border-cream-300 bg-cream-100 px-3 pt-20 md:flex"
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

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-8 border-t border-cream-300 bg-cream-100 md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 text-[0.625rem] font-medium transition-colors',
                active ? 'text-terracotta-700' : 'text-sage-600 hover:text-sage-800',
              )}
            >
              <NavIcon d={item.icon} />
              <span className="leading-none">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
