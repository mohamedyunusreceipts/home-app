// View models passed from the MBA server pages to their client components.

import type { DeadlineKind, DeadlineSource } from '@/lib/mba/classify'
import type { FeedKind } from '@/lib/mba/sync-calendar'

export interface CourseVM {
  code: string
  name: string
  convenor: string | null
  color: string
}

export interface ReadingVM {
  title: string
  kind: 'reading' | 'slides' | 'book'
  /** Location relative to the MBA folder, to help find the file. */
  path?: string
}

export interface SessionVM {
  id: string
  courseCode: string
  sessionKey: string
  title: string
  startsAt: string | null
  endsAt: string | null
  mode: 'in_person' | 'online' | null
  readings: ReadingVM[]
  hasSummary: boolean
  notebookUrl: string | null
  prepared: boolean
  /** Online join link from a matching mailbox-calendar invite, if any. */
  joinUrl: string | null
}

export interface DeadlineVM {
  id: string
  courseCode: string | null
  title: string
  kind: DeadlineKind
  dueAt: string
  allDay: boolean
  weight: string | null
  details: string | null
  source: DeadlineSource
  done: boolean
  confirmedByLms: boolean
}

export interface EventVM {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  location: string | null
  joinUrl: string | null
  courseCode: string | null
}

/** Feed status for display. The URL itself (it embeds a token) never ships. */
export interface FeedVM {
  kind: FeedKind
  host: string
  lastSyncedAt: string | null
  lastSyncError: string | null
  lastSyncCount: number | null
}
