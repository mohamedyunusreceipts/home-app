'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { fmtDay, fmtTime, relativeDays } from '@/lib/mba/format'
import { Icon, ICONS } from './parts'
import type { SessionVM } from './types'

/** Terracotta hero for the next (or in-progress) lecture. */
export function NextLectureHero({ session: s, now }: { session: SessionVM; now: Date }) {
  const started = Date.parse(s.startsAt!) <= now.getTime()
  const readingCount = s.readings.filter((r) => r.kind !== 'slides').length
  const hasSlides = s.readings.some((r) => r.kind === 'slides')
  return (
    <section className="rounded-[22px] bg-[#C77B5C] p-[18px] text-cream-50">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.07em] text-cream-50/85 uppercase">
          Next lecture
        </p>
        <span className="rounded-full bg-cream-50/20 px-2.5 py-0.5 text-[12px] font-semibold">
          {started ? 'In progress' : relativeDays(s.startsAt!, now)}
        </span>
      </div>
      <p className="mt-2 font-serif text-[clamp(22px,6.5vw,28px)] leading-tight font-semibold">
        {s.courseCode} {s.sessionKey} · {s.title}
      </p>
      <p className="mt-1.5 text-[13px] text-cream-50/90 tabular-nums">
        {fmtDay(s.startsAt!)} · {fmtTime(s.startsAt!)}
        {s.endsAt ? `–${fmtTime(s.endsAt)}` : ''} ·{' '}
        {s.mode === 'online' ? 'Online' : s.mode === 'in_person' ? 'In person' : 'TBC'}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
        {readingCount ? (
          <HeroTag on>
            {readingCount} {readingCount === 1 ? 'reading' : 'readings'}
          </HeroTag>
        ) : null}
        {hasSlides ? <HeroTag on>Slides</HeroTag> : null}
        <HeroTag on={s.hasSummary}>{s.hasSummary ? 'Summary ready' : 'No summary yet'}</HeroTag>
        <HeroTag on={!!s.notebookUrl}>{s.notebookUrl ? 'NotebookLM ready' : 'No NotebookLM'}</HeroTag>
        <HeroTag on={s.prepared}>{s.prepared ? 'Prepared ✓' : 'Not prepared'}</HeroTag>
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/mba/session/${s.id}`}
          className="flex-1 rounded-full bg-cream-50 px-4 py-2.5 text-center text-[14px] font-semibold text-terracotta-700"
        >
          Open prep
        </Link>
        {s.joinUrl ? (
          <a
            href={s.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-50/60 px-4 py-2.5 text-[14px] font-semibold"
          >
            <Icon d={ICONS.video} /> Join
          </a>
        ) : null}
      </div>
    </section>
  )
}

function HeroTag({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-semibold ${
        on ? 'bg-cream-50 text-terracotta-700' : 'bg-cream-50/15 text-cream-50/90'
      }`}
    >
      {children}
    </span>
  )
}

const TONES = {
  red: 'border-[#F2CFC7] bg-[#FBE7E2] text-[#A63D2F]',
  amber: 'border-[#EFDDB0] bg-[#FBF3DF] text-[#8A6111]',
  terracotta: 'border-terracotta-100 bg-[#FBF2EE] text-terracotta-600',
  sage: 'border-[#DCE7DC] bg-[#F1F5F1] text-[#3B523C]',
}

export interface StatTile {
  value: string
  label: string
  tone: keyof typeof TONES
}

export function StatsRow({ stats }: { stats: StatTile[] }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {stats.map((s) => (
        <div key={s.label} className={`rounded-[16px] border px-2 py-3.5 text-center ${TONES[s.tone]}`}>
          <p className="font-serif text-[24px] leading-none font-semibold tabular-nums">{s.value}</p>
          <p className="mt-1.5 text-[11px] leading-tight font-medium">{s.label}</p>
        </div>
      ))}
    </div>
  )
}
