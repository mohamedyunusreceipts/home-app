'use client'

import { useState } from 'react'
import { dayKey } from '@/lib/mba/dates'
import {
  currentAndUpcoming,
  formatRange,
  leaveByYear,
  nextAttendanceBlock,
  type KeyDate,
  type KeyDateKind,
} from '@/lib/mba/key-dates'
import { Card, SectionTitle } from './parts'

export const KIND_STYLE: Record<KeyDateKind, { label: string; className: string }> = {
  in_person: { label: 'In person', className: 'bg-[#FBF2EE] text-terracotta-600' },
  hybrid: { label: 'Hybrid', className: 'bg-[#FBF3DF] text-[#8A6111]' },
  online: { label: 'Online', className: 'bg-[#F1F5F1] text-sage-600' },
  break: { label: 'Break', className: 'bg-cream-100 text-[#8a7163]' },
  optional: { label: 'Optional', className: 'bg-[#F3EEF6] text-[#7A5A8E]' },
  milestone: { label: 'Milestone', className: 'bg-[#EEF1F6] text-[#4E6385]' },
}

const COLLAPSED_COUNT = 6
const leave = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? '' : 's'}`
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

export function ProgrammeDatesCard({ keyDates, now }: { keyDates: KeyDate[]; now: Date }) {
  const [showAll, setShowAll] = useState(false)
  const [showOnline, setShowOnline] = useState(false)
  if (!keyDates.length) return null

  const today = dayKey(now)
  const next = nextAttendanceBlock(keyDates, today)
  const years = leaveByYear(keyDates, today)
  const upcoming = currentAndUpcoming(keyDates, today).filter((k) => showOnline || k.kind !== 'online')
  const visible = showAll ? upcoming : upcoming.slice(0, COLLAPSED_COUNT)

  return (
    <Card>
      <SectionTitle>Programme dates</SectionTitle>

      {next ? (
        <div className="mt-3 rounded-[16px] border border-terracotta-100 bg-[#FBF2EE] px-3.5 py-3">
          <p className="text-[11px] font-semibold tracking-[0.05em] text-terracotta-600 uppercase">
            {next.startDate <= today ? 'On now' : 'Next on campus'}
          </p>
          <p className="mt-0.5 font-serif text-[19px] leading-tight font-semibold text-terracotta-900">
            {next.title}{' '}
            <span className="text-[14px] font-normal text-[#8a7163]">({KIND_STYLE[next.kind].label.toLowerCase()})</span>
          </p>
          <p className="mt-0.5 text-[13px] text-[#6B5547] tabular-nums">
            {formatRange(next.startDate, next.endDate)}
            {next.startDate > today ? ` · in ${daysBetween(today, next.startDate)} days` : ''}
            {next.leaveDays ? ` · ${leave(next.leaveDays)} leave` : ''}
          </p>
          {next.notes ? <p className="mt-1 text-[12px] text-[#8a7163]">{next.notes}</p> : null}
        </div>
      ) : null}

      {years.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {years.map((y) => (
            <div key={y.year} className="rounded-[14px] border border-cream-300 bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold text-[#8a7163]">Year {y.year} leave</p>
              <p className="font-serif text-[20px] leading-tight font-semibold text-terracotta-900 tabular-nums">
                {leave(y.total)}
              </p>
              <p className="text-[11px] text-[#8a7163]">
                {y.remaining ? `${leave(y.remaining)} still to take` : 'All taken'}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <ul className="mt-3 divide-y divide-[#F2EBDF]">
        {visible.map((k) => (
          <li key={k.id} className={`flex items-start gap-3 py-2.5 ${k.kind === 'online' ? 'opacity-75' : ''}`}>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-terracotta-900">{k.title}</p>
              <p className="text-[12px] text-[#8a7163] tabular-nums">
                {formatRange(k.startDate, k.endDate)}
                {k.leaveDays ? ` · ${leave(k.leaveDays)} leave` : ''}
              </p>
              {k.notes && k.kind !== 'online' && k.id !== next?.id ? (
                <p className="mt-0.5 text-[12px] text-[#8a7163]">{k.notes}</p>
              ) : null}
            </div>
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[k.kind].className}`}>
              {KIND_STYLE[k.kind].label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {upcoming.length > COLLAPSED_COUNT ? (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[13px] font-semibold text-sage-600 hover:underline">
            {showAll ? 'Show fewer' : `Show all ${upcoming.length}`}
          </button>
        ) : null}
        <button type="button" onClick={() => setShowOnline((v) => !v)} className="text-[13px] font-semibold text-[#8a7163] hover:underline">
          {showOnline ? 'Hide online periods' : 'Show online periods'}
        </button>
      </div>
    </Card>
  )
}
