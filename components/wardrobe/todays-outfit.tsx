'use client'

import { useMemo, useState } from 'react'
import { useShell } from '@/components/shell/shell-context'
import { generateOutfit, type GenItem } from './outfit-gen'

/** A generator item plus the human label shown under its placeholder. */
export type OutfitDisplayItem = GenItem & { label: string }

/**
 * "Today's outfit" card (Focus Timeline redesign, README §7).
 *
 * Reuses the PURE deterministic outfit generator (components/wardrobe/outfit-gen):
 * Shuffle bumps a seed and re-runs generateOutfit (no Math.random — the runtime
 * forbids it), so each tap walks deterministically to the next outfit. On every
 * shuffle it emits the shell toast "New outfit shuffled" via useShell().
 *
 * Up to three chosen garments are shown as 74px placeholders with labels. If the
 * wardrobe is too sparse to dress an outfit, a gentle hint is shown instead.
 */
export function TodaysOutfit({ items }: { items: OutfitDisplayItem[] }) {
  const { showToast } = useShell()
  const [seed, setSeed] = useState(0)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  // First three slots of the everyday outfit (top / bottom / shoes lead the
  // generator's default required order), resolved to display items.
  const garments = useMemo(() => {
    const outfit = generateOutfit(items, {}, { seed })
    return outfit.itemIds
      .map((id) => byId.get(id))
      .filter((it): it is OutfitDisplayItem => Boolean(it))
      .slice(0, 3)
  }, [items, byId, seed])

  function shuffle() {
    setSeed((s) => s + 1)
    showToast('New outfit shuffled')
  }

  return (
    <section
      style={{
        background: '#FBF2EE',
        border: '1px solid #F4DDD2',
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-serif" style={{ fontWeight: 600, fontSize: 17, color: '#793F2D' }}>
          Today&apos;s outfit
        </h2>
        <button
          type="button"
          onClick={shuffle}
          className="inline-flex items-center gap-1.5 transition-colors"
          style={{
            background: '#C77B5C',
            color: '#FFFDF9',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 3h5v5" />
            <path d="M4 20L21 3" />
            <path d="M21 16v5h-5" />
            <path d="M15 15l6 6" />
            <path d="M4 4l5 5" />
          </svg>
          Shuffle
        </button>
      </div>

      {garments.length === 0 ? (
        <p className="mt-3" style={{ fontSize: 13, color: '#8a7163' }}>
          Add a few more clean items and we&apos;ll put a look together for you.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {garments.map((g) => (
            <div key={g.id} className="text-center">
              <div
                aria-hidden="true"
                style={{
                  height: 74,
                  borderRadius: 12,
                  border: '1px solid #F4DDD2',
                  backgroundColor: '#EADFCB',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, transparent, transparent 7px, rgba(216,149,119,0.18) 7px, rgba(216,149,119,0.18) 14px)',
                }}
              />
              <p
                className="mt-1.5 truncate"
                style={{ fontSize: 12, fontWeight: 500, color: '#793F2D' }}
                title={g.label}
              >
                {g.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
