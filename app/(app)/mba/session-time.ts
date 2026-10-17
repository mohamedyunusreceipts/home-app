import type { SessionVM } from './types'

const SESSION_LENGTH_MS = 135 * 60_000 // timetable slots are 2h15

/** When a session ends (ms); undated sessions never end. */
export function sessionEnd(s: Pick<SessionVM, 'startsAt' | 'endsAt'>): number {
  if (s.endsAt) return Date.parse(s.endsAt)
  return s.startsAt ? Date.parse(s.startsAt) + SESSION_LENGTH_MS : Infinity
}
