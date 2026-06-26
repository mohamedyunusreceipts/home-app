'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useShell } from '@/components/shell/shell-context'
import { completeChoreAction } from '@/app/(app)/home/actions'

/** A member avatar's colour role. */
export type ChoreRole = 'owner' | 'partner'

/** One chore due today, with the (optional) assignee's avatar. */
export type ChoreToday = {
  id: string
  name: string
  /** Assignee initial, e.g. "S" — null when unassigned. */
  initial: string | null
  /** Assignee role drives the avatar colour. */
  role: ChoreRole | null
}

/** The nearest upcoming maintenance reminder for the UPKEEP card. */
export type UpkeepItem = {
  item: string
  /** Relative due phrase, e.g. "Due in 12 days". */
  dueLabel: string
}

const ROLE_BG: Record<ChoreRole, string> = {
  owner: '#C77B5C', // terracotta — owner
  partner: '#7A9B7A', // sage — partner
}

/** 26px member-initial avatar (terracotta owner / sage partner). */
function MemberAvatar({ initial, role }: { initial: string; role: ChoreRole | null }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: 26,
        height: 26,
        fontSize: 11,
        background: ROLE_BG[role ?? 'partner'],
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}

/** 26px checkbox — unchecked 2px #B9CFB9 border; checked #7A9B7A fill + white check. */
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        background: checked ? '#7A9B7A' : 'transparent',
        border: checked ? '2px solid #7A9B7A' : '2px solid #B9CFB9',
      }}
    >
      {checked && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: '#7A9B7A',
      }}
    >
      {children}
    </h2>
  )
}

export function ChoresToday({
  chores,
  upkeep,
}: {
  chores: ChoreToday[]
  upkeep: UpkeepItem | null
}) {
  const { showToast } = useShell()
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Optimistic completion state, keyed by chore id.
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const completedCount = Object.values(checked).filter(Boolean).length
  const left = Math.max(0, chores.length - completedCount)

  function toggle(chore: ChoreToday) {
    if (checked[chore.id]) return
    // Optimistic check + toast, then persist via the shared chore action.
    setChecked((prev) => ({ ...prev, [chore.id]: true }))
    showToast(`${chore.name} — done`)
    startTransition(async () => {
      const result = await completeChoreAction(chore.id)
      if ('error' in result) {
        // Roll back on failure.
        setChecked((prev) => ({ ...prev, [chore.id]: false }))
        showToast(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-7">
      {/* CHORES TODAY ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between">
          <SectionLabel>Chores today</SectionLabel>
          {chores.length === 0 ? null : left > 0 ? (
            <span style={{ fontWeight: 600, fontSize: 12, color: '#B36548' }}>
              {left} left
            </span>
          ) : (
            <span style={{ fontWeight: 600, fontSize: 12, color: '#5F8160' }}>
              all done
            </span>
          )}
        </div>

        {chores.length === 0 ? (
          <div
            className="mt-3"
            style={{
              background: '#FFFDF9',
              border: '1px solid #E8DFCE',
              borderRadius: 14,
              padding: '16px 14px',
              fontSize: 13,
              color: '#8a7163',
            }}
          >
            Nothing due today. Enjoy the breather.
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {chores.map((chore) => {
              const isChecked = Boolean(checked[chore.id])
              return (
                <li key={chore.id}>
                  <button
                    type="button"
                    onClick={() => toggle(chore)}
                    disabled={isChecked}
                    className="flex w-full items-center gap-3 text-left"
                    style={{
                      background: isChecked ? '#F1F5F1' : '#FFFDF9',
                      border: '1px solid #E8DFCE',
                      borderRadius: 14,
                      padding: '13px 14px',
                    }}
                  >
                    <Checkbox checked={isChecked} />
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: isChecked ? '#9DB39D' : '#3F2118',
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}
                    >
                      {chore.name}
                    </span>
                    {chore.initial && (
                      <MemberAvatar initial={chore.initial} role={chore.role} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* UPKEEP ─────────────────────────────────────────────────────────── */}
      {upkeep && (
        <section>
          <SectionLabel>Upkeep</SectionLabel>
          <div
            className="mt-3 flex items-center gap-3"
            style={{
              background: '#FFFDF9',
              border: '1px solid #E8DFCE',
              borderRadius: 14,
              padding: '13px 14px',
            }}
          >
            <span
              className="inline-flex shrink-0 items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: 13, background: '#FBF2EE' }}
              aria-hidden="true"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C77B5C"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2-2 2.7-2.7Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <div style={{ fontWeight: 600, fontSize: 14, color: '#3F2118' }}>
                {upkeep.item}
              </div>
              <div className="mt-0.5" style={{ fontSize: 13, color: '#8a7163' }}>
                {upkeep.dueLabel}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
