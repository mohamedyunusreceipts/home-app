'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useShell } from '@/components/shell/shell-context'
import { completeChoreAction } from '@/app/(app)/home/actions'
import { markBillPaidAction } from '@/app/(app)/dashboard/actions'
import type { FeedAvatar, FeedItem } from './feed'

/** Data the server component hands the timeline. */
export type TimelineProps = {
  householdName: string
  dateLabel: string
  /** Member avatars for the overlapping header stack (owner first). */
  avatars: FeedAvatar[]
  /** Time-sorted feed for today. */
  items: FeedItem[]
  /** Seed for the "need you" counter: unpaid bills + unchecked chores. */
  needYou: number
}

const ROLE_BG: Record<'owner' | 'partner', string> = {
  owner: '#C77B5C', // terracotta — first / owner
  partner: '#7A9B7A', // sage — partner
}

/** Small circular member avatar with a role-based background. */
function Avatar({ avatar, size = 32, overlap = false }: { avatar: FeedAvatar; size?: number; overlap?: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: ROLE_BG[avatar.role],
        border: '2px solid #FAF6EF',
        marginLeft: overlap ? -11 : 0,
      }}
    >
      {avatar.initial}
    </span>
  )
}

/** The 3×3-dots ⋮ More button (opens the More sheet). */
function MoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="More"
      // 44px tap target (negative margin keeps the visible 38px chip aligned so
      // surrounding layout is unchanged).
      className="inline-flex items-center justify-center"
      style={{ width: 44, height: 44, margin: -3 }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{ width: 38, height: 38, background: '#F2EBDF', borderRadius: 12 }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          {[3, 9, 15].map((y) =>
            [3, 9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#8a7163" />),
          )}
        </svg>
      </span>
    </button>
  )
}

/** Timeline dot, positioned on the guide line. */
function Dot({ kind }: { kind: FeedItem['dot'] }) {
  // routine = 12px sage + sage ring; action = 14px terracotta + light-terracotta
  // ring; social = sage-300 dot.
  const styles =
    kind === 'action'
      ? { size: 14, bg: '#C77B5C', ring: '#E8B9A3' }
      : kind === 'social'
        ? { size: 12, bg: '#95B695', ring: '#B9CFB9' }
        : { size: 12, bg: '#7A9B7A', ring: '#B9CFB9' }
  return (
    <span
      aria-hidden="true"
      className="absolute rounded-full"
      style={{
        // Centre the dot on the guide line at left:53px (container pad 62px →
        // line sits 9px left of the content edge).
        left: 53 - 62 - styles.size / 2,
        top: 4,
        width: styles.size,
        height: styles.size,
        background: styles.bg,
        boxShadow: `0 0 0 1.5px ${styles.ring}`,
      }}
    />
  )
}

export function TodayTimeline({ householdName, dateLabel, avatars, items, needYou }: TimelineProps) {
  const { showToast, openMore } = useShell()
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Optimistic completion state, seeded from server data.
  const [paidBills, setPaidBills] = useState<Record<string, boolean>>({})
  const [checkedChores, setCheckedChores] = useState<Record<string, boolean>>({})

  // Live "need you" counter: seed minus everything completed this session.
  const completedCount =
    Object.values(paidBills).filter(Boolean).length +
    Object.values(checkedChores).filter(Boolean).length
  const needYouNow = Math.max(0, needYou - completedCount)

  const plannedCount = items.length

  function payBill(item: Extract<FeedItem, { kind: 'bill' }>) {
    if (paidBills[item.id]) return
    setPaidBills((prev) => ({ ...prev, [item.id]: true }))
    showToast(`${item.title} paid · ${item.amountLabel}`)
    startTransition(async () => {
      const result = await markBillPaidAction(item.billKind, item.id)
      if ('error' in result) {
        // Roll back the optimistic flip if the server rejected it.
        setPaidBills((prev) => ({ ...prev, [item.id]: false }))
        showToast(result.error)
        return
      }
      router.refresh()
    })
  }

  function toggleChore(item: Extract<FeedItem, { kind: 'chore' }>) {
    if (checkedChores[item.id]) return
    setCheckedChores((prev) => ({ ...prev, [item.id]: true }))
    showToast(`${item.title} — done`)
    startTransition(async () => {
      const result = await completeChoreAction(item.id)
      if ('error' in result) {
        setCheckedChores((prev) => ({ ...prev, [item.id]: false }))
        showToast(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <main className="px-[22px] pt-4 pb-[120px]">
      <div className="mx-auto max-w-xl">
        {/* Header row: overlapping avatars + name | ⋮ More */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex shrink-0">
              {avatars.map((a, i) => (
                <Avatar key={`${a.initial}-${i}`} avatar={a} overlap={i > 0} />
              ))}
            </span>
            <span className="truncate" style={{ fontWeight: 600, fontSize: 14, color: '#3F2118' }}>
              {householdName}
            </span>
          </div>
          <span className="shrink-0">
            <MoreButton onClick={openMore} />
          </span>
        </div>

        {/* Title block */}
        <div className="mt-5">
          <div className="flex items-baseline gap-2.5">
            <h1 className="font-serif" style={{ fontWeight: 600, fontSize: 34, color: '#3F2118' }}>
              Today
            </h1>
            <span style={{ fontWeight: 500, fontSize: 13, color: '#7A9B7A' }}>{dateLabel}</span>
          </div>
          <p className="mt-0.5" style={{ fontSize: 13, color: '#8a7163' }}>
            {plannedCount} {plannedCount === 1 ? 'thing' : 'things'} planned ·{' '}
            {needYouNow > 0 ? (
              <span style={{ color: '#B36548', fontWeight: 600 }}>{needYouNow} need you</span>
            ) : (
              <span style={{ color: '#5F8160', fontWeight: 600 }}>all caught up</span>
            )}
          </p>
        </div>

        {/* Timeline */}
        {items.length === 0 ? (
          <EmptyDay />
        ) : (
          <div
            className="relative mt-6"
            style={{ paddingLeft: 62 }}
          >
            {/* Continuous guide line behind the dots. */}
            <span
              aria-hidden="true"
              className="absolute"
              style={{ left: 53, top: 8, bottom: 8, width: 2, background: '#E8DFCE' }}
            />
            <ul className="space-y-3.5">
              {items.map((item) => (
                <li key={item.id} className="relative">
                  {/* Time label in the left gutter. */}
                  <span
                    className="absolute"
                    style={{
                      left: 53 - 62 - 12 - 38,
                      top: 1,
                      width: 40,
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 12,
                      color: '#8a7163',
                    }}
                  >
                    {item.timeLabel}
                  </span>
                  <Dot kind={item.dot} />
                  <RowCard
                    item={item}
                    paid={Boolean(paidBills[item.id])}
                    checked={Boolean(checkedChores[item.id])}
                    onPay={payBill}
                    onToggle={toggleChore}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}

function RowCard({
  item,
  paid,
  checked,
  onPay,
  onToggle,
}: {
  item: FeedItem
  paid: boolean
  checked: boolean
  onPay: (item: Extract<FeedItem, { kind: 'bill' }>) => void
  onToggle: (item: Extract<FeedItem, { kind: 'chore' }>) => void
}) {
  if (item.kind === 'bill') {
    return paid ? (
      <PaidCard item={item} />
    ) : (
      <div
        style={{
          background: '#FBF2EE',
          border: '1px solid #F4DDD2',
          borderRadius: 14,
          padding: '11px 14px',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 break-words" style={{ fontWeight: 600, fontSize: 14, color: '#3F2118' }}>
            {item.title}
          </div>
          <div
            className="shrink-0 font-serif"
            style={{ fontWeight: 600, fontSize: 16, color: '#793F2D' }}
          >
            {item.amountLabel}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span
            className="min-w-0 break-words"
            style={{
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#B36548',
            }}
          >
            {item.dueLabel}
          </span>
          <button
            type="button"
            onClick={() => onPay(item)}
            // ≥44px tap height: min-height plus inline-flex centring; visual
            // padding stays compact.
            className="inline-flex shrink-0 items-center justify-center"
            style={{
              background: '#C77B5C',
              color: '#FFFDF9',
              borderRadius: 20,
              minHeight: 44,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Pay now
          </button>
        </div>
      </div>
    )
  }

  if (item.kind === 'chore') {
    return (
      <button
        type="button"
        onClick={() => onToggle(item)}
        className="block w-full text-left"
        style={{
          background: checked ? '#F1F5F1' : '#FFFDF9',
          border: '1px solid #E8DFCE',
          borderRadius: 14,
          padding: '11px 14px',
        }}
      >
        <div className="flex items-center gap-3">
          <Checkbox checked={checked} />
          <div className="min-w-0">
            <div
              className="break-words"
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: checked ? '#9DB39D' : '#3F2118',
                textDecoration: checked ? 'line-through' : 'none',
              }}
            >
              {item.title}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <ModuleTag>{item.tag}</ModuleTag>
            </div>
          </div>
        </div>
      </button>
    )
  }

  // Static (meal / calendar event)
  return (
    <div
      style={{
        background: '#FFFDF9',
        border: '1px solid #E8DFCE',
        borderRadius: 14,
        padding: '11px 14px',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words" style={{ fontWeight: 600, fontSize: 14, color: '#3F2118' }}>
            {item.title}
          </div>
          <div className="mt-0.5">
            <ModuleTag>{item.tag}</ModuleTag>
          </div>
        </div>
        {item.avatar && (
          <span className="shrink-0">
            <Avatar avatar={item.avatar} size={26} />
          </span>
        )}
      </div>
    </div>
  )
}

/** Sage "paid" confirmation state for a bill. */
function PaidCard({ item }: { item: Extract<FeedItem, { kind: 'bill' }> }) {
  return (
    <div
      style={{
        background: '#F1F5F1',
        border: '1px solid #DCE7DC',
        borderRadius: 14,
        padding: '11px 14px',
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full"
          style={{ width: 24, height: 24, background: '#7A9B7A' }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <div
            className="break-words"
            style={{ fontWeight: 600, fontSize: 14, color: '#5F8160', textDecoration: 'line-through' }}
          >
            {item.title}
          </div>
          <ModuleTag>MONEY · paid</ModuleTag>
        </div>
      </div>
    </div>
  )
}

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
          <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

function ModuleTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontWeight: 500,
        fontSize: 11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#7A9B7A',
      }}
    >
      {children}
    </span>
  )
}

function EmptyDay() {
  return (
    <div
      className="mt-8 text-center"
      style={{
        background: '#FFFDF9',
        border: '1px solid #E8DFCE',
        borderRadius: 18,
        padding: '34px 22px',
      }}
    >
      <div className="mx-auto mb-3 flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, background: '#F1F5F1' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7A9B7A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 7v5l3 2" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <div className="font-serif" style={{ fontWeight: 600, fontSize: 19, color: '#3F2118' }}>
        Nothing planned yet
      </div>
      <p className="mt-1" style={{ fontSize: 13, color: '#8a7163' }}>
        Add a meal, bill, event or chore and it&apos;ll show up here on your day.
      </p>
    </div>
  )
}
