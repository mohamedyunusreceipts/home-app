'use client'

import type { ReactNode } from 'react'
import type { DeadlineKind } from '@/lib/mba/classify'
import { relativeDays, urgency } from '@/lib/mba/format'
import type { CourseVM } from './types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] border border-cream-300 bg-cream-50 p-[18px] ${className}`}>
      {children}
    </section>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
        {children}
      </h2>
      {action}
    </div>
  )
}

export function CourseChip({ course, code }: { course?: CourseVM; code: string | null }) {
  const color = course?.color ?? '#8a7163'
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.03em]"
      style={{ background: `${color}1F`, color }}
      title={course?.name}
    >
      {code ?? 'Other'}
    </span>
  )
}

const KIND_LABEL: Record<DeadlineKind, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  presentation: 'Presentation',
  other: 'Deadline',
}

export function KindLabel({ kind }: { kind: DeadlineKind }) {
  return (
    <span
      className={`text-[11px] font-semibold ${kind === 'exam' ? 'text-[#B4483A]' : 'text-[#8a7163]'}`}
    >
      {KIND_LABEL[kind]}
    </span>
  )
}

const PILL: Record<ReturnType<typeof urgency>, string> = {
  done: 'bg-[#EEF3EE] text-sage-600',
  overdue: 'bg-[#FBE7E2] text-[#A63D2F]',
  urgent: 'bg-[#FBF2EE] text-terracotta-600',
  soon: 'bg-[#FBF3DF] text-[#8A6111]',
  later: 'bg-[#F1F5F1] text-sage-600',
}

export function CountdownPill({ iso, now, done = false }: { iso: string; now: Date; done?: boolean }) {
  const u = urgency(iso, now, done)
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${PILL[u]}`}>
      {u === 'done' ? 'Done' : u === 'overdue' ? `Overdue · ${relativeDays(iso, now)}` : relativeDays(iso, now)}
    </span>
  )
}

/** Round tick-box used for "prepared" and "done". */
export function Tick({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onChange(!checked)
      }}
      className={`flex size-[24px] shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-60 ${
        checked ? 'border-[#7A9B7A] bg-[#7A9B7A]' : 'border-[#D8CBB2] bg-white hover:border-[#7A9B7A]'
      }`}
    >
      {checked ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : null}
    </button>
  )
}

export function Icon({ d, size = 15, className = '' }: { d: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  )
}

export const ICONS = {
  book: 'M12 7c-2-1.3-4.5-1.3-7 0v11c2.5-1.3 5-1.3 7 0m0-11c2-1.3 4.5-1.3 7 0v11c-2.5-1.3-5-1.3-7 0m0-11V18',
  slides: 'M3 4h18v12H3zM8 20h8M12 16v4',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2zm16 0a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z',
  video: 'M3 7h12v10H3zM15 10l6-3v10l-6-3',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16.5 4.5a3.5 3.5 0 0 1 0 6.5M21.5 20a6 6 0 0 0-4-5.6',
  pin: 'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  calendar: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
}
