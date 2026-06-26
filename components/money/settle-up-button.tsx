'use client'

import { useState } from 'react'
import { useShell } from '@/components/shell/shell-context'

/**
 * Optimistic "Settle up" control for the Money owes-you tile.
 *
 * There is no real settlement server action / table in the Money module yet
 * (balances are derived live from expenses + splits and never stored), so per
 * the redesign brief this is an optimistic UI: on tap it flips the tile to an
 * "All square" state and emits a toast via the shell. The underlying expense
 * data is left untouched — we do not invent a migration.
 */
export function SettleUpButton({
  amountLabel,
  partnerName,
}: {
  amountLabel: string
  partnerName: string
}) {
  const { showToast } = useShell()
  const [settled, setSettled] = useState(false)

  if (settled) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-semibold text-sage-500">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        All square
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <p className="font-serif text-[28px] font-semibold leading-none text-terracotta-700">
        {amountLabel}
      </p>
      <button
        type="button"
        onClick={() => {
          setSettled(true)
          showToast(`Settled up with ${partnerName}`)
        }}
        className="rounded-full bg-terracotta-100 px-3.5 py-1.5 text-xs font-semibold text-terracotta-700 transition-colors hover:bg-terracotta-200"
      >
        Settle up
      </button>
    </div>
  )
}
