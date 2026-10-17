'use client'

import Link from 'next/link'
import { dayKey, daysUntil } from '@/lib/mba/dates'
import { fmtDay, fmtTime } from '@/lib/mba/format'
import { overlapping, rangeStatus, type KeyDate } from '@/lib/mba/key-dates'
import { Card, CourseChip, Icon, ICONS, KindLabel, SectionTitle } from './parts'
import { KIND_STYLE } from './programme-dates'
import type { CourseVM, DeadlineVM, EventVM, SessionVM } from './types'

type Item =
  | { type: 'session'; at: string; s: SessionVM }
  | { type: 'meeting'; at: string; e: EventVM }
  | { type: 'deadline'; at: string; d: DeadlineVM }

const DAYS_AHEAD = 7

export function AgendaSection({
  now,
  sessions,
  meetings,
  deadlines,
  keyDates,
  courseMap,
}: {
  now: Date
  sessions: SessionVM[]
  meetings: EventVM[]
  deadlines: DeadlineVM[]
  keyDates: KeyDate[]
  courseMap: Map<string, CourseVM>
}) {
  // Blocks, breaks and milestones touching this week (online periods are
  // implied by the lectures themselves).
  const weekStart = dayKey(now)
  const weekEnd = dayKey(new Date(now.getTime() + (DAYS_AHEAD - 1) * 86_400_000))
  const banners = overlapping(keyDates, weekStart, weekEnd).filter((k) => k.kind !== 'online')

  const inRange = (iso: string) => {
    const d = daysUntil(new Date(iso), now)
    return d >= 0 && d < DAYS_AHEAD
  }

  const items: Item[] = [
    ...sessions
      .filter((s) => s.startsAt && inRange(s.startsAt))
      .map((s) => ({ type: 'session' as const, at: s.startsAt!, s })),
    ...meetings
      .filter((e) => inRange(e.startsAt) && Date.parse(e.endsAt ?? e.startsAt) >= now.getTime())
      .map((e) => ({ type: 'meeting' as const, at: e.startsAt, e })),
    ...deadlines
      .filter((d) => !d.done && inRange(d.dueAt))
      .map((d) => ({ type: 'deadline' as const, at: d.dueAt, d })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  const byDay = new Map<string, Item[]>()
  for (const it of items) {
    const k = dayKey(new Date(it.at))
    byDay.set(k, [...(byDay.get(k) ?? []), it])
  }

  return (
    <Card>
      <SectionTitle>This week</SectionTitle>
      {banners.length ? (
        <ul className="mt-3 space-y-1.5">
          {banners.map((k) => (
            <li key={k.id} className="flex items-center gap-2 rounded-[12px] bg-cream-100 px-3 py-2">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[k.kind].className}`}>
                {KIND_STYLE[k.kind].label}
              </span>
              <span className="min-w-0 truncate text-[13px] font-semibold text-terracotta-900">{k.title}</span>
              <span className="ml-auto shrink-0 text-[12px] text-[#8a7163]">{rangeStatus(k, weekStart)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length === 0 ? (
        <p className="mt-3 text-[14px] text-[#8a7163]">
          Nothing scheduled in the next 7 days. A good week to get ahead on readings.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {[...byDay.entries()].map(([key, dayItems]) => {
            const first = dayItems[0]!.at
            const n = daysUntil(new Date(first), now)
            return (
              <div key={key}>
                <p className="text-[12px] font-semibold text-terracotta-900">
                  {n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDay(first)}
                  {n <= 1 ? <span className="font-normal text-[#8a7163]"> · {fmtDay(first)}</span> : null}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {dayItems.map((it) => (
                    <AgendaRow key={`${it.type}-${itemId(it)}`} item={it} courseMap={courseMap} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

const itemId = (it: Item) => (it.type === 'session' ? it.s.id : it.type === 'meeting' ? it.e.id : it.d.id)

function AgendaRow({ item, courseMap }: { item: Item; courseMap: Map<string, CourseVM> }) {
  const time = (
    <span className="w-[44px] shrink-0 pt-0.5 text-[12px] font-semibold text-[#8a7163] tabular-nums">
      {item.type === 'deadline' && item.d.allDay
        ? 'Due'
        : item.type === 'meeting' && item.e.allDay
          ? 'All day'
          : fmtTime(item.at)}
    </span>
  )

  if (item.type === 'session') {
    const { s } = item
    return (
      <li className="flex items-start gap-2 rounded-[12px] bg-white px-3 py-2.5 transition-colors hover:bg-cream-100">
        <Link href={`/mba/session/${s.id}`} className="flex min-w-0 flex-1 items-start gap-2.5">
          {time}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CourseChip course={courseMap.get(s.courseCode)} code={s.courseCode} />
              <span className="text-[11px] text-[#8a7163]">
                Lecture {s.sessionKey} · {s.mode === 'online' ? 'Online' : 'In person'}
              </span>
            </div>
            <p className="mt-0.5 text-[14px] font-semibold text-terracotta-900">{s.title}</p>
            {!s.prepared && (s.readings.length || s.hasSummary) ? (
              <p className="mt-0.5 text-[12px] text-terracotta-600">Pre-reading not done yet</p>
            ) : null}
          </div>
        </Link>
        {s.joinUrl ? <JoinLink url={s.joinUrl} /> : null}
      </li>
    )
  }

  if (item.type === 'meeting') {
    const { e } = item
    return (
      <li className="flex items-start gap-2.5 rounded-[12px] bg-white px-3 py-2.5">
        {time}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] text-[#8a7163]">
            <Icon d={ICONS.people} size={13} />
            {e.courseCode ? <CourseChip course={courseMap.get(e.courseCode)} code={e.courseCode} /> : null}
            Meeting
          </div>
          <p className="mt-0.5 text-[14px] font-semibold text-terracotta-900">{e.title}</p>
          {e.location && !e.location.startsWith('http') ? (
            <p className="mt-0.5 truncate text-[12px] text-[#8a7163]">{e.location}</p>
          ) : null}
        </div>
        {e.joinUrl ? <JoinLink url={e.joinUrl} /> : null}
      </li>
    )
  }

  const { d } = item
  return (
    <li className="flex items-start gap-2.5 rounded-[12px] border border-dashed border-terracotta-200 bg-[#FFFAF7] px-3 py-2.5">
      {time}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <CourseChip course={d.courseCode ? courseMap.get(d.courseCode) : undefined} code={d.courseCode} />
          <KindLabel kind={d.kind} />
        </div>
        <p className="mt-0.5 text-[14px] font-semibold text-terracotta-900">{d.title}</p>
      </div>
    </li>
  )
}

function JoinLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1 self-center rounded-full bg-[#F1F5F1] px-3 py-1.5 text-[12px] font-semibold text-sage-600 hover:bg-[#E4EDE4]"
    >
      <Icon d={ICONS.video} size={13} /> Join
    </a>
  )
}
