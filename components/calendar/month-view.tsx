'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  type CalendarCategory,
  type CalendarEventRow,
} from './types'
import { buildMonthGrid, bucketByDay, monthLabel, stepMonth } from './month'
import { EventDialog } from './event-dialog'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface MonthViewProps {
  rows: CalendarEventRow[]
  initialYear: number
  initialMonth: number
}

export function MonthView({ rows, initialYear, initialMonth }: MonthViewProps) {
  const router = useRouter()
  const [{ year, month }, setView] = useState({
    year: initialYear,
    month: initialMonth,
  })
  const [active, setActive] = useState<Set<CalendarCategory>>(
    () => new Set(ALL_CATEGORIES),
  )
  const [selected, setSelected] = useState<CalendarEventRow | null>(null)
  const [editing, setEditing] = useState<{ open: boolean; row: CalendarEventRow | null }>(
    { open: false, row: null },
  )

  const filtered = useMemo(
    () => rows.filter((r) => active.has(r.category)),
    [rows, active],
  )
  const byDay = useMemo(() => bucketByDay(filtered), [filtered])
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])

  function toggle(cat: CalendarCategory) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function go(delta: number) {
    setView((v) => stepMonth(v.year, v.month, delta))
  }

  return (
    <div className="space-y-4">
      {/* Header: month nav + new-event button. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => go(-1)} aria-label="Previous month">
            ‹
          </Button>
          <h2 className="min-w-44 text-center font-serif text-xl text-terracotta-700">
            {monthLabel(year, month)}
          </h2>
          <Button variant="outline" size="sm" onClick={() => go(1)} aria-label="Next month">
            ›
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView({ year: initialYear, month: initialMonth })}
          >
            Today
          </Button>
        </div>
        <Button size="sm" onClick={() => setEditing({ open: true, row: null })}>
          + New event
        </Button>
      </div>

      {/* Filter chips per category. */}
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat]
          const on = active.has(cat)
          return (
            <button
              key={cat}
              type="button"
              data-on={on}
              onClick={() => toggle(cat)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${meta.chipClass} ${
                on ? '' : 'opacity-50'
              }`}
            >
              <span className={`size-2 rounded-full ${meta.dotClass}`} />
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Month grid. */}
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="grid grid-cols-7 bg-sage-50 text-center text-xs font-medium text-sage-600">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell) => {
            const events = byDay.get(cell.key) ?? []
            return (
              <div
                key={cell.key}
                className={`min-h-24 border-t border-l border-sage-100 p-1 first:border-l-0 [&:nth-child(7n+1)]:border-l-0 ${
                  cell.inMonth ? 'bg-card' : 'bg-sage-50/40'
                }`}
              >
                <div
                  className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs ${
                    cell.isToday
                      ? 'bg-terracotta-400 font-semibold text-cream-50'
                      : cell.inMonth
                        ? 'text-sage-700'
                        : 'text-sage-400'
                  }`}
                >
                  {cell.day}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 4).map((ev, i) => {
                    const meta = CATEGORY_META[ev.category]
                    return (
                      <button
                        key={`${ev.source}-${ev.source_id}-${i}`}
                        type="button"
                        onClick={() => setSelected(ev)}
                        title={ev.title}
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight ${meta.pillClass}`}
                      >
                        {ev.title}
                      </button>
                    )
                  })}
                  {events.length > 4 && (
                    <span className="block px-1 text-[10px] text-sage-500">
                      +{events.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected-event detail popover. */}
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

      {/* Create/edit manual-event dialog. */}
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

// ── Event detail: deep-links non-manual events; manual events get edit/delete. ──
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
        className="w-full max-w-md space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${meta.dotClass}`} />
          <div className="flex-1">
            <h3 className="font-serif text-lg text-terracotta-700">{row.title}</h3>
            <p className="text-xs text-sage-500">{meta.label}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isManual ? (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}>
                Edit
              </Button>
              <DeleteEventButton id={row.source_id} onDeleted={onDeleted} />
            </>
          ) : (
            row.link && (
              <Link href={row.link}>
                <Button size="sm">Open in {meta.label}</Button>
              </Link>
            )
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

function DeleteEventButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        const { deleteEventAction } = await import('@/app/(app)/calendar/actions')
        const fd = new FormData()
        fd.set('id', id)
        const res = await deleteEventAction(fd)
        setPending(false)
        if (!('error' in res)) onDeleted()
      }}
    >
      {pending ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
