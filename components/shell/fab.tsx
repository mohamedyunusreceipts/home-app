'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Quick-add links — only destinations that actually exist today. Spec §6
// (context "+" quick-add). Expand as module create pages get built.
const QUICK_ADD = [{ href: '/mortgage/statements', label: 'Add bond statement' }]

/**
 * Context FAB — fixed bottom-right, sits above the mobile tab bar. Toggles a
 * small menu of quick-add links.
 */
export function Fab() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6"
    >
      {open && (
        <div
          role="menu"
          className="overflow-hidden rounded-xl border border-cream-300 bg-cream-50 py-1 shadow-lg"
        >
          {QUICK_ADD.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block whitespace-nowrap px-4 py-2 text-sm text-sage-800 hover:bg-cream-100"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Quick add"
        className="flex size-14 items-center justify-center rounded-full bg-terracotta-400 text-cream-50 shadow-lg transition-colors hover:bg-terracotta-500"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className={cn('size-7 transition-transform', open && 'rotate-45')}
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}
