import { daysUntil } from '@/lib/mba/dates'
import { sessionEnd } from './session-time'
import type { StatTile } from './hero'
import type { DeadlineVM, SessionVM } from './types'

/** Upcoming (not yet finished) dated sessions, in order. */
export function upcomingSessions(sessions: SessionVM[], now: Date): SessionVM[] {
  return sessions.filter((s) => s.startsAt && sessionEnd(s) > now.getTime())
}

/** The three quick-stat tiles under the hero. */
export function buildStats(sessions: SessionVM[], deadlines: DeadlineVM[], now: Date): StatTile[] {
  const open = deadlines.filter((d) => !d.done)
  const overdue = open.filter((d) => new Date(d.dueAt) < now).length
  const dueThisWeek = open.filter((d) => {
    const n = daysUntil(new Date(d.dueAt), now)
    return n >= 0 && n <= 7
  }).length
  const nextExam = open.find((d) => d.kind === 'exam' && new Date(d.dueAt) >= now)
  const soon = upcomingSessions(sessions, now).filter(
    (s) => daysUntil(new Date(s.startsAt!), now) <= 14,
  )

  return [
    overdue
      ? { value: `${overdue}`, label: 'Overdue', tone: 'red' }
      : { value: `${dueThisWeek}`, label: 'Due in 7 days', tone: dueThisWeek ? 'amber' : 'sage' },
    nextExam
      ? {
          value: `${daysUntil(new Date(nextExam.dueAt), now)}d`,
          label: `To ${nextExam.courseCode ?? ''} exam`.replace('  ', ' '),
          tone: 'terracotta',
        }
      : { value: '—', label: 'No exams set', tone: 'terracotta' },
    {
      value: soon.length ? `${soon.filter((s) => s.prepared).length}/${soon.length}` : '—',
      label: 'Prepped (14 days)',
      tone: 'sage',
    },
  ]
}
