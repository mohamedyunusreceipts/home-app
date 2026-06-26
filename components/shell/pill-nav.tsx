'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useShell } from './shell-context'

// Mobile pill destinations, L→R around the center "+". Icons reuse the SVG
// path data from nav-items.ts / NAV_ITEMS. README "Floating pill nav".
const PILL_ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/dashboard', label: 'Today', icon: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  { href: '/money', label: 'Money', icon: 'M12 3v18M8 7h6a3 3 0 0 1 0 6H8m0 4h8' },
  { href: '/food', label: 'Food', icon: 'M5 3v8a3 3 0 0 0 6 0V3M8 3v18M16 3c-1.5 0-3 1.5-3 5s1.5 5 3 5v8' },
  { href: '/home', label: 'House', icon: 'M3 11.5 12 4l9 7.5M5 10v10h14V10M9 20v-6h6v6' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function PillButton({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="flex size-[46px] items-center justify-center rounded-full"
      style={{ background: active ? '#F4DDD2' : 'transparent' }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? '#C77B5C' : '#8a7163'}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={icon} />
      </svg>
    </Link>
  )
}

/**
 * Floating mobile pill nav — Today · Money · center "+" · Food · House.
 * The center "+" opens the quick-add sheet. Hidden on desktop (≥768px), where
 * the sidebar in primary-nav.tsx takes over. README "Floating pill nav".
 */
export function PillNav() {
  const pathname = usePathname()
  const { openQuickAdd } = useShell()

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-[26px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-[34px] border border-cream-300 bg-cream-50 px-[9px] py-[7px] shadow-[0_16px_36px_rgba(63,33,24,.24)] md:hidden"
    >
      {PILL_ITEMS.slice(0, 2).map((item) => (
        <PillButton key={item.href} {...item} active={isActive(pathname, item.href)} />
      ))}

      <button
        type="button"
        onClick={openQuickAdd}
        aria-label="Quick add"
        className="mx-0.5 flex size-[52px] items-center justify-center rounded-full bg-terracotta-400 shadow-[0_8px_18px_rgba(151,79,56,.4)]"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFDF9"
          strokeWidth={2.2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {PILL_ITEMS.slice(2).map((item) => (
        <PillButton key={item.href} {...item} active={isActive(pathname, item.href)} />
      ))}
    </nav>
  )
}
