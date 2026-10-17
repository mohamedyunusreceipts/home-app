// Classify LMS calendar events into deliverables and fold LMS duplicates into
// the known schedule. Pure functions — no I/O.

import { dayKey } from './dates'

export type DeadlineKind = 'assignment' | 'exam' | 'quiz' | 'presentation' | 'other'
export type DeadlineSource = 'schedule' | 'lms' | 'manual'

export interface CourseMatcher {
  code: string
  name: string
  aliases: string[]
}

export function detectKind(text: string): DeadlineKind {
  if (/\b(exam|examination|test)\b/i.test(text)) return 'exam'
  if (/\bquiz(zes)?\b/i.test(text)) return 'quiz'
  if (/\bpresentation\b|\bpitch\b(?!\s+deck)/i.test(text)) return 'presentation'
  if (/\b(assignment|due|submission|submit|essay|report|hand-?in|dropbox|folder)\b/i.test(text)) {
    return 'assignment'
  }
  return 'other'
}

/** Short all-caps tokens (course codes) must match as whole, case-sensitive words. */
function matchesToken(text: string, token: string): boolean {
  if (/^[A-Z0-9]{2,6}$/.test(token)) {
    return new RegExp(`(^|[^A-Za-z0-9])${token}([^A-Za-z0-9]|$)`).test(text)
  }
  return text.toLowerCase().includes(token.toLowerCase())
}

export function detectCourse(text: string, courses: CourseMatcher[]): string | null {
  // Most reliable signal: the LMS offering name, e.g. "MBA MOD 2026/27 MKT | Marketing".
  const offering = /MBA\s+MOD\s+[\d/]+\s+([A-Z]{2,6})\b/.exec(text)?.[1]
  if (offering) {
    const hit = courses.find((c) => c.code === offering || c.aliases.includes(offering))
    if (hit) return hit.code
  }
  for (const c of courses) {
    if ([c.code, c.name, ...c.aliases].some((t) => t && matchesToken(text, t))) return c.code
  }
  return null
}

export interface EventText {
  summary: string
  description: string
  location: string
}

/**
 * Decide whether an LMS event is a deliverable worth tracking. Returns null for
 * window-opening events and plain calendar entries (class sessions etc.).
 */
export function classifyEvent(
  ev: EventText,
  courses: CourseMatcher[],
): { kind: DeadlineKind; courseCode: string | null } | null {
  if (/availability\s+starts|start\s+date|\bopens\b/i.test(ev.summary)) return null
  const kind = detectKind(`${ev.summary} ${ev.description}`)
  if (kind === 'other' && !/\b(due|deadline|ends|end date|closes)\b/i.test(ev.summary)) {
    return null
  }
  return {
    kind,
    courseCode: detectCourse(`${ev.summary}\n${ev.location}\n${ev.description}`, courses),
  }
}

export interface DeadlineLike {
  id: string
  source: DeadlineSource
  courseCode: string | null
  kind: DeadlineKind
  dueAt: string
}

/**
 * Merge LMS items into schedule/manual items that describe the same deliverable
 * (same course, compatible kind, same SAST day) so nothing is listed twice; the
 * surviving item is flagged `confirmedByLms`. Output is sorted by due date.
 */
export function mergeDeadlines<T extends DeadlineLike>(
  items: T[],
): (T & { confirmedByLms: boolean })[] {
  const primary = items
    .filter((d) => d.source !== 'lms')
    .map((d) => ({ ...d, confirmedByLms: false }))
  const extra: (T & { confirmedByLms: boolean })[] = []

  for (const l of items.filter((d) => d.source === 'lms')) {
    const day = dayKey(new Date(l.dueAt))
    const match = l.courseCode
      ? primary.find(
          (p) =>
            p.courseCode === l.courseCode &&
            (p.kind === l.kind || p.kind === 'other' || l.kind === 'other') &&
            dayKey(new Date(p.dueAt)) === day,
        )
      : undefined
    if (match) match.confirmedByLms = true
    else extra.push({ ...l, confirmedByLms: false })
  }

  return [...primary, ...extra].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
}
