'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  type CalendarCategory,
  type CalendarEventRow,
} from './types'
import {
  bucketByDay,
  buildWeekStrip,
  buildAgenda,
  monthLabelUpper,
  timeLabelOf,
  todayKey,
} from './month'
import { EventDialog } from './event-dialog'

const agendaHeadingStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#8a7163',
}

interface FocusTimelineProps {
  rows: CalendarEventRow[]
  /** Display year/month for the month label (app timezone). */
  year: number
  month: number
}

/**
 * Calendar — "Focus Timeline" redesign. A month label + Mon–Sun week strip
 * (today = terracotta pill, event days get a dot), then an agenda grouped by
 * day ("TODAY · …" + "LATER THIS WEEK"). Manual events can still be created /
 * edited (event-dialog) and category source filters are preserved.
 */
export function FocusTimeline({ rows, year, month }: FocusTimelineProps) {
  const router = useRouter()
  const today = useMemo(() => todayKey(), [])

  const [active, setActive] = useState<Set<CalendarCategory>>(
    () => new Set(ALL_CATEGORIES),
  )
  const [selected, setSelected] = useState<CalendarEventRow | null>(null)
  const [editing, setEditing] = useState<{ open: boolean; row: CalendarEventRow | null }>({
    open: false,
    row: null,
  })

  const filtered = useMemo(() => rows.filter((r) => active.has(r.category)), [rows, active])
  const byDay = useMemo(() => bucketByDay(filtered), [filtered])
  const week = useMemo(() => buildWeekStrip(byDay, today), [byDay, today])
  const agenda = useMemo(() => buildAgenda(byDay, today), [byDay, today])
  const todayGroup = agenda[0] ?? null
  const laterGroups = agenda.slice(1)

  function toggle(cat: CalendarCategory) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div>
      {/* Month label */}
      <div
        style={{
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#7A9B7A',
        }}
      >
        {monthLabelUpper(year, month)}
      </div>

      {/* Week strip (Mon–Sun) */}
      <div className="mt-2.5 grid grid-cols-7 gap-1">
        {week.map((d) => (
          <div key={d.key} className="flex flex-col items-center">
            <span
              style={{
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: '0.06em',
                color: '#B9A98C',
              }}
            >
              {d.weekdayLetter}
            </span>
            <span
              className="mt-1.5 inline-flex items-center justify-center"
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 14,
                background: d.isToday ? '#C77B5C' : 'transparent',
                color: d.isToday ? '#FFFDF9' : '#3F2118',
              }}
            >
              {d.day}
            </span>
            <span
              aria-hidden="true"
              className="mt-1 rounded-full"
              style={{
                width: 4,
                height: 4,
                background: d.hasEvents ? (d.special ? '#C77B5C' : '#7A9B7A') : 'transparent',
              }}
            />
          </div>
        ))}
      </div>

      {/* Category source filters (preserved) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat]
          const on = active.has(cat)
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggle(cat)}
              className="inline-flex min-h-[44px] items-center gap-1.5"
              style={{
                borderRadius: 999,
                border: '1px solid #E8DFCE',
                background: on ? '#FFFDF9' : 'transparent',
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 500,
                color: on ? '#3F2118' : '#8a7163',
                opacity: on ? 1 : 0.6,
              }}
            >
              <span className={`size-2 rounded-full ${meta.dotClass}`} />
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Agenda grouped by day */}
      <div className="mt-6 space-y-6">
        {/* TODAY */}
        {todayGroup && (
          <section>
            <h2 style={agendaHeadingStyle}>TODAY · {todayGroup.label}</h2>
            <div className="mt-2.5 space-y-2.5">
              {todayGroup.events.length === 0 ? (
                <EmptyRow />
              ) : (
                todayGroup.events.map((ev, i) => (
                  <EventRow
                    key={`${ev.source}-${ev.source_id}-${i}`}
                    row={ev}
                    onClick={() => setSelected(ev)}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {/* LATER THIS WEEK */}
        {laterGroups.length > 0 && (
          <section>
            <h2 style={agendaHeadingStyle}>LATER THIS WEEK</h2>
            <div className="mt-2.5 space-y-2.5">
              {laterGroups.flatMap((group) =>
                group.events.map((ev, i) => (
                  <EventRow
                    key={`${ev.source}-${ev.source_id}-${i}`}
                    row={ev}
                    dowPrefix={group.dow}
                    onClick={() => setSelected(ev)}
                  />
                )),
              )}
            </div>
          </section>
        )}
      </div>

      {/* Create manual event */}
      <button
        type="button"
        onClick={() => setEditing({ open: true, row: null })}
        className="mt-6 flex w-full items-center justify-center gap-2"
        style={{
          borderRadius: 16,
          border: '1px dashed #DBCFB7',
          background: '#FFFDF9',
          padding: '13px 16px',
          fontSize: 14,
          fontWeight: 600,
          color: '#5F8160',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New event
      </button>

      {/* Selected-event detail */}
      {selected && (
        <EventDetail
          row={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing({ open: true, row: selected })
            setSelected(null)
          }}
          onDeleted={() => {
            setSelected(null)
            router.refresh()
          }}
        />
      )}

      {/* Create/edit manual-event dialog */}
      {editing.open && (
        <EventDialog
          row={editing.row}
          onClose={() => setEditing({ open: false, row: null })}
          onSaved={() => {
            setEditing({ open: false, row: null })
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

/** A category colour dot in the redesign palette. */
function CategoryDot({ category }: { category: CalendarCategory }) {
  return <span className={`size-2.5 shrink-0 rounded-full ${CATEGORY_META[category].dotClass}`} />
}

function CakeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C77B5C"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 6V3" />
      <path d="M4 16v-3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
      <path d="M4 16c1.3 1.3 2.7 1.3 4 0s2.7-1.3 4 0 2.7 1.3 4 0 2.7-1.3 4 0" />
      <path d="M5 21h14" />
    </svg>
  )
}

/**
 * One agenda event row. In the TODAY group the time sits on the left; in the
 * LATER THIS WEEK group a short weekday (dowPrefix) sits on the left and the
 * time on the right. Birthdays get the highlighted (terracotta) treatment with
 * a cake icon + "All day".
 */
function EventRow({
  row,
  onClick,
  dowPrefix,
}: {
  row: CalendarEventRow
  onClick: () => void
  dowPrefix?: string
}) {
  const isBirthday = row.category === 'birthdays'
  const time = timeLabelOf(row)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 text-left"
      style={{
        background: isBirthday ? '#FBF2EE' : '#FFFDF9',
        border: `1px solid ${isBirthday ? '#F4DDD2' : '#E8DFCE'}`,
        borderRadius: 14,
        padding: '11px 14px',
      }}
    >
      {/* Left gutter: DOW (later rows) or time (today rows). */}
      <span
        style={{
          width: 38,
          fontWeight: 600,
          fontSize: 12,
          color: isBirthday ? '#B36548' : '#8a7163',
        }}
      >
        {dowPrefix ?? time}
      </span>

      {isBirthday ? <CakeIcon /> : <CategoryDot category={row.category} />}

      <span
        className="min-w-0 flex-1 break-words"
        style={{ fontWeight: 600, fontSize: 14, color: isBirthday ? '#793F2D' : '#3F2118' }}
      >
        {row.title}
      </span>

      {/* Right side: "All day" for birthdays; the time for later non-today rows. */}
      {isBirthday ? (
        <span style={{ fontSize: 12, fontWeight: 500, color: '#B36548' }}>All day</span>
      ) : dowPrefix ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: '#8a7163' }}>{time}</span>
      ) : null}
    </button>
  )
}

function EmptyRow() {
  return (
    <div
      style={{
        background: '#FFFDF9',
        border: '1px solid #E8DFCE',
        borderRadius: 14,
        padding: '11px 14px',
        fontSize: 13,
        color: '#8a7163',
      }}
    >
      Nothing planned today.
    </div>
  )
}

// ── Event detail: manual events get edit/delete; others deep-link out. ────────
function EventDetail({
  row,
  onClose,
  onEdit,
  onDeleted,
}: {
  row: CalendarEventRow
  onClose: () => void
  onEdit: () => void
  onDeleted: () => void
}) {
  const meta = CATEGORY_META[row.category]
  const isManual = row.category === 'manual'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <CategoryDot category={row.category} />
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-lg text-terracotta-900">{row.title}</h3>
            <p className="text-xs text-sage-500">
              {meta.label} · {timeLabelOf(row)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isManual ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="min-h-[44px]"
                style={{ borderRadius: 999, border: '1px solid #E8DFCE', background: '#FFFDF9', padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#3F2118' }}
              >
                Edit
              </button>
              <DeleteEventButton id={row.source_id} onDeleted={onDeleted} />
            </>
          ) : (
            row.link && (
              <Link
                href={row.link}
                className="inline-flex min-h-[44px] items-center"
                style={{ borderRadius: 999, background: '#C77B5C', padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#FFFDF9' }}
              >
                Open in {meta.label}
              </Link>
            )
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px]"
            style={{ borderRadius: 999, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#8a7163' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteEventButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-[44px]"
      onClick={async () => {
        setPending(true)
        const { deleteEventAction } = await import('@/app/(app)/calendar/actions')
        const fd = new FormData()
        fd.set('id', id)
        const res = await deleteEventAction(fd)
        setPending(false)
        if (!('error' in res)) onDeleted()
      }}
      style={{
        borderRadius: 999,
        border: '1px solid #F4DDD2',
        background: '#FBF2EE',
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 600,
        color: '#974F38',
        opacity: pending ? 0.5 : 1,
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  )
}
