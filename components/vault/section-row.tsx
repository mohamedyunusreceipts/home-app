import type { ReactNode } from 'react'

/**
 * Focus Timeline Vault section row (handoff §8): an icon chip (40×40,
 * #F1F5F1 bg / #5F8160 icon) + label + real count (#B9A98C) + a chevron.
 *
 * Rendered as the <summary> of a native <details> so the create affordances
 * (item list + create form) stay reachable one tap away. The chevron rotates
 * when the section is open.
 */
export type VaultIcon =
  | 'documents'
  | 'contacts'
  | 'vehicles'
  | 'vehicleDocs'
  | 'warranties'
  | 'gifts'

const ICON_PATHS: Record<VaultIcon, ReactNode> = {
  documents: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  contacts: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  vehicles: (
    <>
      <path d="M5 16v-4l2-5h10l2 5v4" />
      <path d="M4 16h16" />
      <circle cx="8" cy="17.5" r="1.6" />
      <circle cx="16" cy="17.5" r="1.6" />
    </>
  ),
  vehicleDocs: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 14l2 2 4-4" />
    </>
  ),
  warranties: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  gifts: (
    <>
      <path d="M4 9h16v3H4zM5 12h14v8H5zM12 9v11" />
      <path d="M12 9S10 4 8 6s4 3 4 3zM12 9s2-5 4-3-4 3-4 3z" />
    </>
  ),
}

/** The icon-chip + label + count + chevron summary content. */
export function SectionRowSummary({
  icon,
  label,
  count,
}: {
  icon: VaultIcon
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 p-3 transition-colors hover:bg-cream-100">
      <span
        className="flex shrink-0 items-center justify-center rounded-xl"
        style={{ width: 40, height: 40, background: '#F1F5F1' }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5F8160"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICON_PATHS[icon]}
        </svg>
      </span>
      <span className="flex-1 text-[15px] font-semibold text-terracotta-900">{label}</span>
      <span className="text-sm font-medium" style={{ color: '#B9A98C' }}>
        {count}
      </span>
      <svg
        className="text-[#B9A98C] transition-transform group-open:rotate-90"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </div>
  )
}
