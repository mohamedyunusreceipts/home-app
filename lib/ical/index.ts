/**
 * iCalendar (.ics) builder — RFC 5545.
 *
 * A pure, dependency-free function that turns normalised calendar rows (the shape
 * produced by the v_calendar_* views, spec §8.3) into an iCalendar 2.0 document.
 * Used by the per-household feed route (app/api/ical/[token]/route.ts).
 *
 * Each row becomes a VEVENT carrying UID, DTSTART/DTEND, SUMMARY, DESCRIPTION
 * (with a deep link back into the app) and CATEGORIES.
 *
 * ── Date handling ────────────────────────────────────────────────────────────
 * All-day events use DATE values (VALUE=DATE, e.g. 20260626) per RFC 5545; the
 * DTEND of an all-day event is the day AFTER the last day (exclusive). For
 * all-day rows the view already sets "end" to the exclusive end, so we emit it
 * as-is. Timed events use UTC date-times (e.g. 20260626T143000Z). The app's
 * locale is Africa/Johannesburg (no DST), but emitting UTC keeps the feed
 * unambiguous for any consuming calendar.
 */

/** A normalised calendar row, matching the v_calendar_all view shape. */
export interface CalendarRow {
  household_id: string
  source: string
  source_id: string
  title: string
  /** ISO timestamp string (timestamptz) for the start. */
  start: string
  /** ISO timestamp string for the end; may be null. */
  end: string | null
  all_day: boolean
  category: string
  /** In-app relative path, e.g. `/money` or `/travel/<id>`. */
  link: string | null
}

/** Options for {@link buildICalendar}. */
export interface BuildICalendarOptions {
  /**
   * Absolute base URL of the app, e.g. `https://home.example.com`. Used to turn
   * each row's relative `link` into an absolute deep link in the DESCRIPTION.
   * Trailing slash is tolerated. When omitted, the relative path is used as-is.
   */
  appUrl?: string
  /** PRODID identifier. Defaults to a sensible app-specific value. */
  prodId?: string
  /** Calendar display name (X-WR-CALNAME). Defaults to "Home". */
  calendarName?: string
}

const CRLF = '\r\n'

/**
 * Escape a value for an iCalendar TEXT field (RFC 5545 §3.3.11): backslash,
 * semicolon, comma and newlines are escaped.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

/** Two-digit zero-pad. */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Format a Date as a UTC date-time stamp: YYYYMMDDTHHMMSSZ. */
function formatUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** Format a Date as an all-day DATE value: YYYYMMDD (in UTC). */
function formatDateValue(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}

/**
 * Fold a content line to 75 octets per RFC 5545 §3.1. Continuation lines start
 * with a single space. We fold on character boundaries (the app's text is ASCII
 * / BMP-dominant; folding by UTF-16 code unit is a safe approximation here).
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let remaining = line
  // First chunk: 75 chars. Subsequent chunks: 74 (leading space counts toward 75).
  parts.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`)
    remaining = remaining.slice(74)
  }
  return parts.join(CRLF)
}

/** Join the app URL and a relative link into an absolute URL (or return the link). */
function deepLink(link: string | null, appUrl?: string): string | null {
  if (!link) return null
  if (!appUrl) return link
  if (/^https?:\/\//i.test(link)) return link
  const base = appUrl.replace(/\/+$/, '')
  const path = link.startsWith('/') ? link : `/${link}`
  return `${base}${path}`
}

/**
 * Build a stable, RFC-compliant UID for a row. Combines source + source_id so the
 * same event keeps its UID across feed refreshes (calendar apps de-dupe on UID).
 */
function buildUid(row: CalendarRow): string {
  return `${row.source}-${row.source_id}@home.app`
}

/**
 * Build a complete iCalendar 2.0 document from normalised calendar rows.
 * Returns a CRLF-delimited string suitable for serving as `text/calendar`.
 */
export function buildICalendar(
  rows: CalendarRow[],
  options: BuildICalendarOptions = {},
): string {
  const {
    appUrl,
    prodId = '-//Home//Couples Home App//EN',
    calendarName = 'Home',
  } = options

  // A single DTSTAMP for the whole generation pass (when the feed was built).
  const dtstamp = formatUtcStamp(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]

  for (const row of rows) {
    const start = new Date(row.start)
    if (Number.isNaN(start.getTime())) continue // skip unparseable rows defensively
    const endRaw = row.end ?? row.start
    const end = new Date(endRaw)
    const endValid = !Number.isNaN(end.getTime())

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${buildUid(row)}`)
    lines.push(`DTSTAMP:${dtstamp}`)

    if (row.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateValue(start)}`)
      if (endValid) {
        lines.push(`DTEND;VALUE=DATE:${formatDateValue(end)}`)
      }
    } else {
      lines.push(`DTSTART:${formatUtcStamp(start)}`)
      if (endValid) {
        lines.push(`DTEND:${formatUtcStamp(end)}`)
      }
    }

    lines.push(`SUMMARY:${escapeText(row.title)}`)

    const url = deepLink(row.link, appUrl)
    if (url) {
      lines.push(`DESCRIPTION:${escapeText(`Open in Home: ${url}`)}`)
      lines.push(`URL:${escapeText(url)}`)
    }

    // CATEGORIES is a comma-separated list of TEXT; capitalise for display.
    const category = row.category
      ? row.category.charAt(0).toUpperCase() + row.category.slice(1)
      : 'Other'
    lines.push(`CATEGORIES:${escapeText(category)}`)

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return lines.map(foldLine).join(CRLF) + CRLF
}
