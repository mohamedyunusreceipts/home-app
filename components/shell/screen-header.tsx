import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Standard header for every non-Today screen in the Focus Timeline redesign:
 * a back chevron (returns to Today) + a Fraunces title, with an optional
 * right-aligned action (e.g. an "Edit"/"New trip"/"Birthdays" pill).
 * Per handoff: chevron stroke #8a7163, title Fraunces 600 27px #3F2118,
 * padding 6px 0 16px.
 */
export function ScreenHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-center justify-between pb-4 pt-1.5">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          aria-label="Back to Today"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[#8a7163] transition-colors hover:bg-cream-200"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="font-serif text-[27px] font-semibold text-terracotta-900">
          {title}
        </h1>
      </div>
      {action ? <div className="flex items-center">{action}</div> : null}
    </header>
  )
}
