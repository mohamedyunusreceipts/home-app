// Link mailbox-calendar events to timetable sessions (so a lecture invite's
// online join link shows on the session) and pull join links out of event text.

const JOIN_PATTERNS = [
  /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"')\]]+/i,
  /https:\/\/teams\.live\.com\/meet\/[^\s<>"')\]]+/i,
  /https:\/\/[\w.-]*zoom\.us\/(?:j|my|s|w)\/[^\s<>"')\]]+/i,
  /https:\/\/meet\.google\.com\/[a-z0-9-]+/i,
]

/** First online-meeting join link found in the given text, if any. */
export function extractJoinUrl(...texts: string[]): string | null {
  for (const text of texts) {
    for (const re of JOIN_PATTERNS) {
      const m = re.exec(text)
      if (m) return m[0]
    }
  }
  return null
}

export interface SessionSlot {
  id: string
  courseCode: string
  startsAt: string | null
}

export interface EventSlot {
  id: string
  courseCode: string | null
  startsAt: string
}

const MATCH_WINDOW_MS = 45 * 60_000

/**
 * Pair each event with the timetable session it represents: starts within 45
 * minutes AND is the same course — or, when the event names no course, is the
 * only session in that window. Each session takes its closest event.
 */
export function matchEventsToSessions(
  sessions: SessionSlot[],
  events: EventSlot[],
): { eventBySession: Record<string, string>; matchedEventIds: Set<string> } {
  const eventBySession: Record<string, string> = {}
  const bestGap: Record<string, number> = {}

  for (const ev of events) {
    const t = Date.parse(ev.startsAt)
    const near = sessions.filter(
      (s) => s.startsAt && Math.abs(Date.parse(s.startsAt) - t) <= MATCH_WINDOW_MS,
    )
    const target = ev.courseCode
      ? near.find((s) => s.courseCode === ev.courseCode)
      : near.length === 1
        ? near[0]
        : undefined
    if (!target) continue
    const gap = Math.abs(Date.parse(target.startsAt!) - t)
    if (bestGap[target.id] === undefined || gap < bestGap[target.id]!) {
      bestGap[target.id] = gap
      eventBySession[target.id] = ev.id
    }
  }

  return { eventBySession, matchedEventIds: new Set(Object.values(eventBySession)) }
}
