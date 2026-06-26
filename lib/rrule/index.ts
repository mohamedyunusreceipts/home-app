import { RRule, rrulestr, Frequency, type Options, type WeekdayStr } from 'rrule'

/**
 * Recurrence (RFC 5545 RRULE) helper library.
 *
 * A thin, well-tested wrapper around the `rrule` package. One library serves the
 * calendar export, the next-due calculator, and the scheduler trigger (design
 * spec §8.4). Recurrence is persisted as RFC 5545 RRULE strings.
 *
 * ── Timezone / DST assumption ────────────────────────────────────────────────
 * All occurrence math is performed in UTC. The `rrule` package treats the
 * components of the JS `Date` objects it returns as wall-clock numbers in UTC
 * (it never applies a local offset), so callers must interpret the returned
 * `Date`s as UTC instants. The app's locale is Africa/Johannesburg (UTC+2, no
 * DST), so wall-clock dates map to UTC by a fixed +2h offset and there are no
 * spring-forward / fall-back gaps to reason about. Keeping everything in UTC
 * here means the helpers are deterministic regardless of the host machine's
 * timezone.
 *
 * ── DTSTART handling ─────────────────────────────────────────────────────────
 * An RRULE needs an anchor (`DTSTART`) to enumerate occurrences. A stored rule
 * MAY omit it (e.g. just `FREQ=WEEKLY;BYDAY=MO`). When a parsed rule has no
 * dtstart, these helpers supply one:
 *   - `nextOccurrence`     → anchors at `after` (default: now).
 *   - `occurrencesBetween` → anchors at `start`.
 * This makes "the rule, evaluated relative to this point in time" the natural
 * semantics for a dtstart-less rule, which is what the next-due calculator and
 * scheduler want. A rule that DOES carry a `DTSTART` is always respected as-is.
 *
 * ── Error handling contract ──────────────────────────────────────────────────
 * - Query helpers (`nextOccurrence`, `occurrencesBetween`) THROW a clear `Error`
 *   on an unparseable rule string, because a malformed stored rule is a
 *   programming/data error the caller should surface, not silently swallow.
 *   `nextOccurrence` returns `null` only for the legitimate "rule has ended"
 *   case (COUNT/UNTIL exhausted).
 * - `isValidRrule` never throws; it returns a boolean.
 * - `buildRrule` THROWS on invalid options.
 */

/** A two-letter RFC 5545 weekday code. */
export type Weekday = WeekdayStr

/** Supported recurrence frequencies for {@link buildRrule}. */
export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Options for {@link buildRrule}. Covers the common cases the app needs. */
export interface BuildRruleOptions {
  /** How often the event repeats. */
  freq: RecurrenceFreq
  /** Repeat every N periods (default 1). Must be a positive integer. */
  interval?: number
  /**
   * Weekdays the event falls on, e.g. `['MO', 'WE', 'FR']`. Most meaningful for
   * weekly rules but accepted for any frequency.
   */
  weekdays?: Weekday[]
  /**
   * Stop after this many occurrences. Mutually exclusive with `until`.
   * Must be a positive integer.
   */
  count?: number
  /**
   * Stop on/after this date (inclusive per RFC 5545). Mutually exclusive with
   * `count`. Interpreted as a UTC instant.
   */
  until?: Date
}

const WEEKDAY_MAP: Record<Weekday, number> = {
  MO: RRule.MO.weekday,
  TU: RRule.TU.weekday,
  WE: RRule.WE.weekday,
  TH: RRule.TH.weekday,
  FR: RRule.FR.weekday,
  SA: RRule.SA.weekday,
  SU: RRule.SU.weekday,
}

const FREQ_MAP: Record<RecurrenceFreq, Frequency> = {
  daily: Frequency.DAILY,
  weekly: Frequency.WEEKLY,
  monthly: Frequency.MONTHLY,
  yearly: Frequency.YEARLY,
}

/**
 * Parse an RRULE string into an {@link RRule}, throwing a clear error if it is
 * invalid. If the parsed rule has no `dtstart`, one is injected.
 */
function parseRule(rruleString: string, fallbackDtstart: Date): RRule {
  let rule: RRule
  try {
    // `rrulestr` can return an RRuleSet; for our single-rule strings it returns
    // an RRule. We force the simple-rule path by re-reading origOptions below.
    const parsed = rrulestr(rruleString)
    rule = parsed instanceof RRule ? parsed : RRule.fromString(rruleString)
  } catch (err) {
    throw new Error(
      `Invalid RRULE string: ${rruleString} (${err instanceof Error ? err.message : String(err)})`,
    )
  }

  if (rule.origOptions.dtstart == null) {
    rule = new RRule(
      { ...rule.origOptions, dtstart: fallbackDtstart },
      // noCache: false — caching is fine, options are deterministic.
    )
  }
  return rule
}

/**
 * The next occurrence strictly after `after` (default: now), or `null` if the
 * rule has no further occurrences (e.g. exhausted by COUNT/UNTIL).
 *
 * @throws {Error} if `rruleString` cannot be parsed.
 */
export function nextOccurrence(rruleString: string, after: Date = new Date()): Date | null {
  const rule = parseRule(rruleString, after)
  // `after(date, inc=false)` → first occurrence strictly after `date`.
  return rule.after(after, false)
}

/**
 * All occurrences within the inclusive window `[start, end]`.
 *
 * @throws {Error} if `rruleString` cannot be parsed, or if `start` > `end`.
 */
export function occurrencesBetween(rruleString: string, start: Date, end: Date): Date[] {
  if (start.getTime() > end.getTime()) {
    throw new Error('occurrencesBetween: `start` must be on or before `end`.')
  }
  const rule = parseRule(rruleString, start)
  // `between(after, before, inc=true)` → occurrences in [after, before].
  return rule.between(start, end, true)
}

/**
 * Human-readable description of a rule, e.g. "every week on Monday".
 * Returns a best-effort string; never throws for a parseable rule.
 *
 * @throws {Error} if `rruleString` cannot be parsed.
 */
export function describeRrule(rruleString: string): string {
  // toText needs a dtstart only for UNTIL phrasing; the epoch is a safe anchor
  // purely for description purposes and does not affect the recurrence wording.
  const rule = parseRule(rruleString, new Date(Date.UTC(2000, 0, 1)))
  return rule.toText()
}

/**
 * Parse-validate an RRULE string. Returns `true` if it parses into a usable
 * rule, `false` otherwise. Never throws.
 */
export function isValidRrule(rruleString: string): boolean {
  if (typeof rruleString !== 'string' || rruleString.trim() === '') {
    return false
  }
  try {
    const parsed = rrulestr(rruleString)
    const rule = parsed instanceof RRule ? parsed : RRule.fromString(rruleString)
    // A valid rule must at least have a frequency.
    return rule.origOptions.freq != null
  } catch {
    return false
  }
}

/**
 * Build an RRULE string for the common cases the app needs. The returned string
 * omits `DTSTART` — the anchor is supplied at evaluation time (see module docs).
 *
 * @throws {Error} on invalid options (bad interval/count, both count & until,
 *                 unknown weekday).
 */
export function buildRrule(opts: BuildRruleOptions): string {
  const { freq, interval = 1, weekdays, count, until } = opts

  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error(`buildRrule: \`interval\` must be a positive integer, got ${interval}.`)
  }
  if (count != null && until != null) {
    throw new Error('buildRrule: `count` and `until` are mutually exclusive.')
  }
  if (count != null && (!Number.isInteger(count) || count < 1)) {
    throw new Error(`buildRrule: \`count\` must be a positive integer, got ${count}.`)
  }

  const options: Partial<Options> = {
    freq: FREQ_MAP[freq],
    interval,
  }

  if (weekdays != null && weekdays.length > 0) {
    options.byweekday = weekdays.map((wd) => {
      const day = WEEKDAY_MAP[wd]
      if (day == null) {
        throw new Error(`buildRrule: unknown weekday "${wd}".`)
      }
      return day
    })
  }
  if (count != null) {
    options.count = count
  }
  if (until != null) {
    options.until = until
  }

  // `RRule.optionsToString` emits the RRULE line without a DTSTART when none is
  // set, which is exactly the storage form we want.
  return RRule.optionsToString(options)
}
