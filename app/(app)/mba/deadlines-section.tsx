'use client'

import { useState, useTransition } from 'react'
import { useShell } from '@/components/shell/shell-context'
import type { DeadlineKind } from '@/lib/mba/classify'
import { fmtDay, fmtTime } from '@/lib/mba/format'
import { addManualDeadline, deleteManualDeadline } from './actions'
import { Card, CountdownPill, CourseChip, Icon, ICONS, KindLabel, SectionTitle, Tick } from './parts'
import type { CourseVM, DeadlineVM } from './types'

const COLLAPSED_COUNT = 6

export function DeadlinesSection({
  now,
  deadlines,
  courses,
  courseMap,
  onToggleDone,
}: {
  now: Date
  deadlines: DeadlineVM[]
  courses: CourseVM[]
  courseMap: Map<string, CourseVM>
  onToggleDone: (id: string, done: boolean) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)

  const open = deadlines.filter((d) => !d.done)
  const done = deadlines.filter((d) => d.done)
  const visible = showAll ? open : open.slice(0, COLLAPSED_COUNT)

  return (
    <Card>
      <SectionTitle
        action={
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-cream-300 bg-white px-3 py-1 text-[12px] font-semibold text-sage-600 hover:bg-cream-100"
          >
            <Icon d={ICONS.plus} size={13} /> {adding ? 'Close' : 'Add'}
          </button>
        }
      >
        Assignments &amp; exams · {open.length}
      </SectionTitle>

      {adding ? <AddDeadlineForm courses={courses} onDone={() => setAdding(false)} /> : null}

      {open.length === 0 ? (
        <p className="mt-3 text-[14px] text-[#8a7163]">Nothing outstanding. 🎉</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((d) => (
            <DeadlineRow key={d.id} d={d} now={now} courseMap={courseMap} onToggleDone={onToggleDone} />
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {open.length > COLLAPSED_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[13px] font-semibold text-sage-600 hover:underline"
          >
            {showAll ? 'Show fewer' : `Show all ${open.length}`}
          </button>
        ) : null}
        {done.length ? (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-[13px] font-semibold text-[#8a7163] hover:underline"
          >
            {showDone ? 'Hide completed' : `Completed (${done.length})`}
          </button>
        ) : null}
      </div>

      {showDone && done.length ? (
        <ul className="mt-2 space-y-2 opacity-70">
          {done.map((d) => (
            <DeadlineRow key={d.id} d={d} now={now} courseMap={courseMap} onToggleDone={onToggleDone} />
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

function DeadlineRow({
  d,
  now,
  courseMap,
  onToggleDone,
}: {
  d: DeadlineVM
  now: Date
  courseMap: Map<string, CourseVM>
  onToggleDone: (id: string, done: boolean) => void
}) {
  const { showToast } = useShell()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const isExam = d.kind === 'exam'

  function remove() {
    startTransition(async () => {
      const r = await deleteManualDeadline(d.id)
      showToast('error' in r ? r.error : 'Deadline removed')
    })
  }

  return (
    <li
      className={`rounded-[14px] border px-3 py-2.5 ${
        isExam && !d.done ? 'border-[#F2CFC7] bg-[#FFF7F5]' : 'border-cream-300 bg-white'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">
          <Tick checked={d.done} onChange={(v) => onToggleDone(d.id, v)} label={`Mark ${d.title} done`} />
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <CourseChip course={d.courseCode ? courseMap.get(d.courseCode) : undefined} code={d.courseCode} />
            <KindLabel kind={d.kind} />
          </div>
          <p className={`mt-0.5 text-[14px] font-semibold ${d.done ? 'text-[#8a7163] line-through' : 'text-terracotta-900'}`}>
            {d.title}
          </p>
          <p className="mt-0.5 text-[12px] text-[#8a7163] tabular-nums">
            {fmtDay(d.dueAt)} · {d.allDay ? 'end of day' : fmtTime(d.dueAt)}
            {d.weight ? <span className="font-semibold text-[#6B5547]"> · {d.weight}</span> : null}
            {d.source === 'lms' ? ' · from Amathuba' : d.confirmedByLms ? ' · ✓ on Amathuba' : ''}
            {d.source === 'manual' ? ' · added by you' : ''}
          </p>
        </button>
        <CountdownPill iso={d.dueAt} now={now} done={d.done} />
      </div>

      {open ? (
        <div className="mt-2 ml-[34px] space-y-2">
          {d.details ? (
            <p className="text-[13px] whitespace-pre-line text-[#6B5547]">{d.details}</p>
          ) : (
            <p className="text-[13px] text-[#8a7163]">No extra details.</p>
          )}
          {d.source === 'manual' ? (
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="text-[12px] font-semibold text-[#A63D2F] hover:underline disabled:opacity-60"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

const KINDS: { value: DeadlineKind; label: string }[] = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'exam', label: 'Exam' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'other', label: 'Other' },
]

const field =
  'w-full rounded-[12px] border border-cream-300 bg-white px-3 py-2.5 text-[15px] text-terracotta-900'

function AddDeadlineForm({ courses, onDone }: { courses: CourseVM[]; onDone: () => void }) {
  const { showToast } = useShell()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [courseCode, setCourseCode] = useState(courses[0]?.code ?? '')
  const [kind, setKind] = useState<DeadlineKind>('assignment')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await addManualDeadline({ title, courseCode: courseCode || null, kind, date, time })
      if ('error' in r) {
        showToast(r.error)
      } else {
        showToast('Deadline added')
        onDone()
      }
    })
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-[14px] border border-cream-300 bg-white p-3">
      <input
        className={field}
        placeholder="What's due? e.g. Reflective essay"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <select className={field} value={courseCode} onChange={(e) => setCourseCode(e.target.value)} aria-label="Course">
          {courses.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
          <option value="">Other</option>
        </select>
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value as DeadlineKind)} aria-label="Type">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} required aria-label="Due date" />
        <input className={field} type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Due time (optional)" />
      </div>
      <p className="text-[12px] text-[#8a7163]">Leave the time empty for end of day (SA time).</p>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-terracotta-400 px-4 py-2.5 text-[14px] font-semibold text-cream-50 hover:bg-terracotta-500 disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add deadline'}
      </button>
    </form>
  )
}
