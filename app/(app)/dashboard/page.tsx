import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { formatZarRounded } from '@/components/money/format'
import { TodayTimeline } from '@/components/dashboard/today-timeline'
import {
  type FeedAvatar,
  type FeedItem,
  type BillFeedItem,
  type ChoreFeedItem,
  type StaticFeedItem,
  headerDateLabel,
  todayIsoJhb,
  SLOT_MINUTES,
  SLOT_TIME_LABEL,
  slotTitle,
  timestampToMinutesJhb,
  timestampToTimeLabelJhb,
} from '@/components/dashboard/feed'

type MemberRow = {
  user_id: string
  role: 'owner' | 'partner'
  profiles: { display_name: string | null; email: string } | null
}

type MealRow = {
  id: string
  slot: 'breakfast' | 'lunch' | 'dinner'
  recipe_id: string | null
  free_text: string | null
}

type BillRowLite = { id: string; name: string; amount: number; next_due: string | null }
type SubRowLite = { id: string; name: string; amount: number; next_charge: string | null }
type ChoreRowLite = {
  id: string
  name: string
  next_due: string | null
  last_done_at: string | null
  assignee_user_id: string | null
}
type CalRow = {
  source: string
  source_id: string
  title: string
  start: string
  category: string
  all_day: boolean
}

/** First grapheme of a member's display name (fallback to email), uppercased. */
function initialOf(member: MemberRow): string {
  const name = member.profiles?.display_name || member.profiles?.email || '?'
  return name.trim().charAt(0).toUpperCase() || '?'
}

/**
 * Today — a single time-sorted feed for the day (Africa/Johannesburg) merging
 * meals, bills/subscriptions, calendar events and chores. "need you" counts the
 * actionable-today items not yet done (unpaid bills/subs + unticked chores).
 */
export default async function DashboardPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const today = todayIsoJhb()

  const [
    { data: household },
    { data: memberRows },
    { data: mealRows },
    { data: recipeRows },
    { data: billRows },
    { data: subRows },
    { data: choreRows },
    { data: calRows },
  ] = await Promise.all([
    supabase.from('households').select('name').eq('id', householdId).maybeSingle<{ name: string }>(),
    supabase
      .from('household_members')
      .select('user_id, role, profiles ( display_name, email )')
      .eq('household_id', householdId)
      .returns<MemberRow[]>(),
    supabase
      .from('meal_plan')
      .select('id, slot, recipe_id, free_text')
      .eq('household_id', householdId)
      .eq('date', today)
      .is('deleted_at', null)
      .returns<MealRow[]>(),
    supabase
      .from('recipes')
      .select('id, name')
      .eq('household_id', householdId)
      .returns<{ id: string; name: string }[]>(),
    // Bills due today or overdue (next_due ≤ today).
    supabase
      .from('bills')
      .select('id, name, amount, next_due')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .not('next_due', 'is', null)
      .lte('next_due', today)
      .returns<BillRowLite[]>(),
    supabase
      .from('subscriptions')
      .select('id, name, amount, next_charge')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .not('next_charge', 'is', null)
      .lte('next_charge', today)
      .returns<SubRowLite[]>(),
    // Chores due today or overdue (next_due ≤ today).
    supabase
      .from('chores')
      .select('id, name, next_due, last_done_at, assignee_user_id')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .not('next_due', 'is', null)
      .lte('next_due', today)
      .returns<ChoreRowLite[]>(),
    // Calendar events whose start falls on today (timestamps span the local day).
    supabase
      .from('v_calendar_all')
      .select('source, source_id, title, start, category, all_day')
      .eq('household_id', householdId)
      .returns<CalRow[]>(),
  ])

  const members = memberRows ?? []
  // Owner first (terracotta), partner second (sage).
  const sortedMembers = [...members].sort((a, b) =>
    a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1,
  )
  const avatars: FeedAvatar[] = sortedMembers.map((m) => ({
    initial: initialOf(m),
    role: m.role,
  }))
  const memberAvatarById: Record<string, FeedAvatar> = {}
  for (const m of members) {
    memberAvatarById[m.user_id] = { initial: initialOf(m), role: m.role }
  }

  const recipeNames: Record<string, string> = {}
  for (const r of recipeRows ?? []) recipeNames[r.id] = r.name

  const items: FeedItem[] = []

  // ── Meals (FOOD, routine) ────────────────────────────────────────────────
  for (const meal of mealRows ?? []) {
    const label =
      meal.recipe_id != null ? (recipeNames[meal.recipe_id] ?? 'Recipe') : (meal.free_text ?? '')
    const title = label ? `${slotTitle(meal.slot)} · ${label}` : slotTitle(meal.slot)
    const m: StaticFeedItem = {
      kind: 'static',
      id: `meal-${meal.id}`,
      sortMinutes: SLOT_MINUTES[meal.slot],
      timeLabel: SLOT_TIME_LABEL[meal.slot],
      title,
      tag: 'FOOD',
      module: 'food',
      dot: 'routine',
    }
    items.push(m)
  }

  // ── Bills + subscriptions (MONEY, actionable) ────────────────────────────
  // No clock time on a due date → anchor at 09:00 like the reference.
  const MONEY_MINUTES = 9 * 60
  for (const b of billRows ?? []) {
    const overdue = (b.next_due ?? today) < today
    const item: BillFeedItem = {
      kind: 'bill',
      billKind: 'bill',
      id: `bill-${b.id}`,
      sortMinutes: MONEY_MINUTES,
      timeLabel: '09:00',
      title: b.name,
      tag: 'MONEY',
      module: 'money',
      dot: 'action',
      amountLabel: formatZarRounded(b.amount),
      dueLabel: overdue ? 'MONEY · overdue' : 'MONEY · due today',
    }
    items.push(item)
  }
  for (const s of subRows ?? []) {
    const overdue = (s.next_charge ?? today) < today
    const item: BillFeedItem = {
      kind: 'bill',
      billKind: 'subscription',
      id: `sub-${s.id}`,
      sortMinutes: MONEY_MINUTES,
      timeLabel: '09:00',
      title: s.name,
      tag: 'MONEY',
      module: 'money',
      dot: 'action',
      amountLabel: formatZarRounded(s.amount),
      dueLabel: overdue ? 'MONEY · overdue' : 'MONEY · due today',
    }
    items.push(item)
  }

  // ── Calendar events today (tag by category, social dot) ──────────────────
  for (const ev of calRows ?? []) {
    // Filter to events whose start is on today's local calendar date. (The view
    // also surfaces bills/chores/meals; we already render those natively, so
    // skip those categories to avoid duplication.)
    if (['bills', 'chores', 'meals', 'maintenance'].includes(ev.category)) continue
    const startsToday = todayIsoJhb(new Date(ev.start)) === today
    if (!startsToday) continue
    const cal: StaticFeedItem = {
      kind: 'static',
      id: `cal-${ev.source}-${ev.source_id}`,
      sortMinutes: ev.all_day ? 0 : timestampToMinutesJhb(ev.start),
      timeLabel: ev.all_day ? 'All day' : timestampToTimeLabelJhb(ev.start),
      title: ev.title,
      tag: ev.category.toUpperCase(),
      module: 'calendar',
      dot: 'social',
    }
    items.push(cal)
  }

  // ── Chores due today/overdue, not done today (HOUSE, actionable) ─────────
  for (const c of choreRows ?? []) {
    const doneToday = c.last_done_at != null && todayIsoJhb(new Date(c.last_done_at)) === today
    if (doneToday) continue
    const chore: ChoreFeedItem = {
      kind: 'chore',
      id: `chore-${c.id}`,
      sortMinutes: 17 * 60 + 30, // 17:30, like the reference bins chore
      timeLabel: '17:30',
      title: c.name,
      tag: 'HOUSE',
      module: 'chore',
      dot: 'action',
      ...(c.assignee_user_id && memberAvatarById[c.assignee_user_id]
        ? { avatar: memberAvatarById[c.assignee_user_id] }
        : {}),
    }
    items.push(chore)
  }

  // Sort the whole feed by derived time.
  items.sort((a, b) => a.sortMinutes - b.sortMinutes)

  // "need you" = actionable-today items not yet done = unpaid bills/subs +
  // unticked chores currently in the feed.
  const needYou = items.filter((i) => i.kind === 'bill' || i.kind === 'chore').length

  return (
    <TodayTimeline
      householdName={household?.name ?? 'Home'}
      dateLabel={headerDateLabel()}
      avatars={avatars}
      items={items}
      needYou={needYou}
    />
  )
}
