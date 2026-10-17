import { describe, it, expect } from 'vitest'
import {
  detectKind,
  detectCourse,
  classifyEvent,
  mergeDeadlines,
  type CourseMatcher,
  type DeadlineLike,
} from '@/lib/mba/classify'

const COURSES: CourseMatcher[] = [
  { code: 'MKT', name: 'Marketing', aliases: [] },
  { code: 'RRM', name: 'Research for Responsible Management', aliases: ['RM'] },
  { code: 'SE', name: 'Strategic Entrepreneurship', aliases: [] },
]

describe('detectKind', () => {
  it.each([
    ['Final Exam', 'exam'],
    ['FIN Mid-Term Test', 'exam'],
    ['Session 3 quiz - Availability Ends', 'quiz'],
    ['Pitch presentation 1', 'presentation'],
    ['Group Assignment - Due', 'assignment'],
    ['Final concept note submission', 'assignment'],
    ['Office hours', 'other'],
  ] as const)('%s → %s', (text, kind) => {
    expect(detectKind(text)).toBe(kind)
  })
})

describe('detectCourse', () => {
  it('prefers the LMS offering code pattern', () => {
    expect(detectCourse('MBA MOD 2026/27 MKT | Marketing', COURSES)).toBe('MKT')
  })
  it('matches codes as whole words only', () => {
    expect(detectCourse('SE session quiz', COURSES)).toBe('SE')
    expect(detectCourse('Please SEE the brief', COURSES)).toBeNull()
  })
  it('matches names and aliases case-insensitively', () => {
    expect(detectCourse('research for responsible management ethics', COURSES)).toBe('RRM')
    expect(detectCourse('RM concept note', COURSES)).toBe('RRM')
  })
  it('returns null when nothing matches', () => {
    expect(detectCourse('Library closed', COURSES)).toBeNull()
  })
})

describe('classifyEvent', () => {
  const base = { description: '', location: '' }
  it('skips availability-start events', () => {
    expect(
      classifyEvent({ ...base, summary: 'Quiz 1 - Availability Starts' }, COURSES),
    ).toBeNull()
  })
  it('skips plain events that are not deliverables', () => {
    expect(classifyEvent({ ...base, summary: 'Class session' }, COURSES)).toBeNull()
  })
  it('keeps "other" events that are explicitly due', () => {
    expect(classifyEvent({ ...base, summary: 'Peer review - Due' }, COURSES)).toEqual({
      kind: 'assignment',
      courseCode: null,
    })
    expect(classifyEvent({ ...base, summary: 'Ethics form deadline' }, COURSES)).toEqual({
      kind: 'other',
      courseCode: null,
    })
  })
  it('detects course from location text', () => {
    expect(
      classifyEvent(
        { summary: 'Group Assignment - Due', description: '', location: 'MBA MOD 2026/27 MKT' },
        COURSES,
      ),
    ).toEqual({ kind: 'assignment', courseCode: 'MKT' })
  })
})

describe('mergeDeadlines', () => {
  const sched = (over: Partial<DeadlineLike>): DeadlineLike => ({
    id: 's1',
    source: 'schedule',
    courseCode: 'MKT',
    kind: 'assignment',
    dueAt: '2026-11-08T16:00:00.000Z',
    ...over,
  })
  const lms = (over: Partial<DeadlineLike>): DeadlineLike => ({
    id: 'l1',
    source: 'lms',
    courseCode: 'MKT',
    kind: 'assignment',
    dueAt: '2026-11-08T21:59:00.000Z',
    ...over,
  })

  it('folds an LMS duplicate (same course, kind and local day) into the schedule item', () => {
    const out = mergeDeadlines([sched({}), lms({})])
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe('s1')
    expect(out[0]!.confirmedByLms).toBe(true)
  })

  it('keeps LMS items on a different day or course', () => {
    const out = mergeDeadlines([
      sched({}),
      lms({ id: 'l2', dueAt: '2026-11-09T10:00:00.000Z' }),
      lms({ id: 'l3', courseCode: 'SE' }),
    ])
    expect(out.map((d) => d.id).sort()).toEqual(['l2', 'l3', 's1'])
  })

  it('treats SAST local day boundaries correctly (23:30 UTC is the next SAST day)', () => {
    const out = mergeDeadlines([sched({}), lms({ dueAt: '2026-11-08T23:30:00.000Z' })])
    expect(out).toHaveLength(2)
  })

  it('sorts by due date ascending', () => {
    const out = mergeDeadlines([
      sched({ id: 'late', dueAt: '2026-12-12T07:00:00.000Z' }),
      sched({ id: 'early', dueAt: '2026-10-20T17:00:00.000Z' }),
    ])
    expect(out.map((d) => d.id)).toEqual(['early', 'late'])
  })
})
