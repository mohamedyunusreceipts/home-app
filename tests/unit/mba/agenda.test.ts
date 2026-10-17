import { describe, it, expect } from 'vitest'
import { extractJoinUrl, matchEventsToSessions } from '@/lib/mba/agenda'

describe('extractJoinUrl', () => {
  it('finds a Teams link inside Outlook-style text (with angle brackets)', () => {
    const text =
      'Join the meeting now<https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d>\nMeeting ID: 123'
    expect(extractJoinUrl(text)).toBe(
      'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d',
    )
  })
  it('finds Zoom and Meet links, checking each text in order', () => {
    expect(extractJoinUrl('', 'Zoom: https://uct.zoom.us/j/9876543210?pwd=x')).toBe(
      'https://uct.zoom.us/j/9876543210?pwd=x',
    )
    expect(extractJoinUrl('https://meet.google.com/abc-defg-hij')).toBe(
      'https://meet.google.com/abc-defg-hij',
    )
  })
  it('returns null when there is no join link', () => {
    expect(extractJoinUrl('Room 3, GSB Breakwater', 'https://example.com')).toBeNull()
  })
})

describe('matchEventsToSessions', () => {
  const sessions = [
    { id: 'mkt6', courseCode: 'MKT', startsAt: '2026-10-27T17:00:00.000Z' },
    { id: 'ppm8', courseCode: 'PPM', startsAt: '2026-10-29T17:00:00.000Z' },
    { id: 'tbc', courseCode: 'SE', startsAt: null },
  ]

  it('matches on course + nearby start', () => {
    const r = matchEventsToSessions(sessions, [
      { id: 'e1', courseCode: 'MKT', startsAt: '2026-10-27T16:55:00.000Z' },
    ])
    expect(r.eventBySession).toEqual({ mkt6: 'e1' })
    expect(r.matchedEventIds.has('e1')).toBe(true)
  })

  it('matches a course-less event only when exactly one session is near', () => {
    const r = matchEventsToSessions(sessions, [
      { id: 'e2', courseCode: null, startsAt: '2026-10-29T17:00:00.000Z' },
    ])
    expect(r.eventBySession).toEqual({ ppm8: 'e2' })
  })

  it('does not match a different course or a far-off time', () => {
    const r = matchEventsToSessions(sessions, [
      { id: 'e3', courseCode: 'SE', startsAt: '2026-10-27T17:00:00.000Z' },
      { id: 'e4', courseCode: 'MKT', startsAt: '2026-10-27T19:00:00.000Z' },
    ])
    expect(r.eventBySession).toEqual({})
  })

  it('a session keeps its closest event', () => {
    const r = matchEventsToSessions(sessions, [
      { id: 'far', courseCode: 'MKT', startsAt: '2026-10-27T17:40:00.000Z' },
      { id: 'near', courseCode: 'MKT', startsAt: '2026-10-27T17:05:00.000Z' },
    ])
    expect(r.eventBySession).toEqual({ mkt6: 'near' })
  })
})
