// Types + pure helpers for the Today timeline feed (Focus Timeline redesign).
//
// The dashboard merges four data sources into a single time-sorted feed for
// TODAY (Africa/Johannesburg): meals, bills/subscriptions, calendar events, and
// chores. This file defines the shared item shape and the time-derivation rules;
// the page (server component) does the Supabase reads and assembles the feed,
// and the client timeline renders + makes the actionable items interactive.

/** Which module a feed item belongs to — drives the uppercase tag + dot colour. */
export type FeedModule = 'food' | 'money' | 'calendar' | 'chore'

/** Visual dot style per README §1. */
export type DotKind = 'routine' | 'action' | 'social'

/** A single avatar (member initial + role-based colour). */
export type FeedAvatar = { initial: string; role: 'owner' | 'partner' }

/** Base fields shared by every timeline entry. */
type FeedItemBase = {
  /** Stable React key. */
  id: string
  /** Minutes since midnight, used purely for sorting. */
  sortMinutes: number
  /** Left-gutter label, e.g. "08:00". */
  timeLabel: string
  /** Card title (Inter 600 14px). */
  title: string
  /** Uppercase module tag, e.g. "FOOD". */
  tag: string
  module: FeedModule
  dot: DotKind
  /** Optional member avatar shown on the right of the card (calendar items). */
  avatar?: FeedAvatar
}

/** A non-interactive entry (meal, calendar event). */
export type StaticFeedItem = FeedItemBase & { kind: 'static' }

/** An actionable bill/subscription due today/overdue — "Pay now". */
export type BillFeedItem = FeedItemBase & {
  kind: 'bill'
  /** 'bill' | 'subscription' — selects the table the action updates. */
  billKind: 'bill' | 'subscription'
  /** Formatted amount, e.g. "R890". */
  amountLabel: string
  /** Sub-tag, e.g. "MONEY · due today" or "MONEY · overdue". */
  dueLabel: string
}

/** An actionable chore due today/overdue — checkbox tick-off. */
export type ChoreFeedItem = FeedItemBase & {
  kind: 'chore'
}

export type FeedItem = StaticFeedItem | BillFeedItem | ChoreFeedItem

/** Slot → rough time of day (README §1). */
export const SLOT_MINUTES: Record<'breakfast' | 'lunch' | 'dinner', number> = {
  breakfast: 8 * 60, // 08:00
  lunch: 12 * 60 + 30, // 12:30
  dinner: 18 * 60 + 30, // 18:30
}

export const SLOT_TIME_LABEL: Record<'breakfast' | 'lunch' | 'dinner', string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '18:30',
}

/** Title-case a meal slot for display, e.g. "breakfast" → "Breakfast". */
export function slotTitle(slot: 'breakfast' | 'lunch' | 'dinner'): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1)
}

/** Two-letter time label "HH:MM" from minutes-since-midnight. */
export function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Today's calendar date (YYYY-MM-DD) in the app timezone (Africa/Johannesburg).
 * Used to filter the date-only DB columns and the calendar view.
 */
export function todayIsoJhb(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Human header date, e.g. "Tue 26 Jun" (app timezone). */
export function headerDateLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(now)
}

/** Minutes-since-midnight (app timezone) for an ISO timestamp. */
export function timestampToMinutesJhb(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

/** "HH:MM" label (app timezone) for an ISO timestamp. */
export function timestampToTimeLabelJhb(iso: string): string {
  return minutesToLabel(timestampToMinutesJhb(iso))
}
