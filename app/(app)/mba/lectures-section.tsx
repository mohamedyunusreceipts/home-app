'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MBA_TZ } from '@/lib/mba/dates'
import { fmtTime } from '@/lib/mba/format'
import { Card, CourseChip, Icon, ICONS, SectionTitle, Tick } from './parts'
import { sessionEnd } from './session-time'
import type { CourseVM, SessionVM } from './types'

type Tab = 'upcoming' | 'past' | 'tbc'
const COLLAPSED_COUNT = 8

const dayNum = new Intl.DateTimeFormat('en-GB', { timeZone: MBA_TZ, day: 'numeric' })
const monShort = new Intl.DateTimeFormat('en-GB', { timeZone: MBA_TZ, month: 'short' })
const wkShort = new Intl.DateTimeFormat('en-GB', { timeZone: MBA_TZ, weekday: 'short' })

export function LecturesSection({
  now,
  sessions,
  courseMap,
  onTogglePrepared,
}: {
  now: Date
  sessions: SessionVM[]
  courseMap: Map<string, CourseVM>
  onTogglePrepared: (id: string, prepared: boolean) => void
}) {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [showAll, setShowAll] = useState(false)

  const upcoming = sessions.filter((s) => s.startsAt && sessionEnd(s) > now.getTime())
  const past = sessions.filter((s) => s.startsAt && sessionEnd(s) <= now.getTime()).reverse()
  const tbc = sessions.filter((s) => !s.startsAt)
  const lists: Record<Tab, SessionVM[]> = { upcoming, past, tbc }
  const list = lists[tab]
  const visible = showAll ? list : list.slice(0, COLLAPSED_COUNT)

  return (
    <Card>
      <SectionTitle>Lectures &amp; pre-reading</SectionTitle>
      <div className="mt-3 flex gap-1 rounded-full bg-cream-100 p-1" role="tablist">
        {(
          [
            ['upcoming', 'Upcoming'],
            ['past', 'Past'],
            ['tbc', 'Date TBC'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key)
              setShowAll(false)
            }}
            className={`flex-1 rounded-full px-2 py-1.5 text-[13px] font-semibold transition-colors ${
              tab === key ? 'bg-white text-terracotta-900 shadow-sm' : 'text-[#8a7163]'
            }`}
          >
            {label} <span className="font-normal opacity-70">{lists[key].length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-3 text-[14px] text-[#8a7163]">
          {tab === 'upcoming' ? 'No upcoming lectures.' : tab === 'past' ? 'No past lectures yet.' : 'Every session has a date.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 rounded-[14px] border border-cream-300 bg-white px-3 py-2.5">
              <Link href={`/mba/session/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                {s.startsAt ? (
                  <div className="w-[42px] shrink-0 text-center">
                    <p className="text-[10px] font-semibold text-[#8a7163] uppercase">{wkShort.format(new Date(s.startsAt))}</p>
                    <p className="font-serif text-[20px] leading-none font-semibold text-terracotta-900">
                      {dayNum.format(new Date(s.startsAt))}
                    </p>
                    <p className="text-[10px] text-[#8a7163]">{monShort.format(new Date(s.startsAt))}</p>
                  </div>
                ) : (
                  <div className="w-[42px] shrink-0 text-center text-[11px] font-semibold text-[#8a7163]">TBC</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <CourseChip course={courseMap.get(s.courseCode)} code={s.courseCode} />
                    <span className="text-[11px] text-[#8a7163] tabular-nums">
                      {s.sessionKey}
                      {s.startsAt ? ` · ${fmtTime(s.startsAt)}` : ''}
                      {s.mode ? ` · ${s.mode === 'online' ? 'Online' : 'In person'}` : ''}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[14px] font-semibold text-terracotta-900">{s.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-[#8a7163]">
                    {s.readings.some((r) => r.kind !== 'slides') ? (
                      <span className="inline-flex items-center gap-1">
                        <Icon d={ICONS.book} size={12} /> {s.readings.filter((r) => r.kind !== 'slides').length}
                      </span>
                    ) : null}
                    {s.readings.some((r) => r.kind === 'slides') ? (
                      <span className="inline-flex items-center gap-1">
                        <Icon d={ICONS.slides} size={12} /> Slides
                      </span>
                    ) : null}
                    {s.hasSummary ? (
                      <span className="inline-flex items-center gap-1 text-sage-600">
                        <Icon d={ICONS.spark} size={12} /> Summary
                      </span>
                    ) : null}
                    {s.notebookUrl ? (
                      <span className="inline-flex items-center gap-1 text-sage-600">
                        <Icon d={ICONS.headphones} size={12} /> NotebookLM
                      </span>
                    ) : null}
                    {s.joinUrl ? (
                      <span className="inline-flex items-center gap-1 text-sage-600">
                        <Icon d={ICONS.video} size={12} /> Join link
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
              <Tick
                checked={s.prepared}
                onChange={(v) => onTogglePrepared(s.id, v)}
                label={`Mark ${s.courseCode} ${s.sessionKey} as prepared`}
              />
            </li>
          ))}
        </ul>
      )}

      {list.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-[13px] font-semibold text-sage-600 hover:underline"
        >
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      ) : null}
      <p className="mt-3 text-[12px] text-[#8a7163]">Tick a lecture once you&apos;ve done its pre-reading.</p>
    </Card>
  )
}
