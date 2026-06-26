import Link from 'next/link'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { ScreenHeader } from '@/components/shell/screen-header'
import { HOME_SECTIONS } from '@/components/home/section-nav'
import { todayIsoJhb } from '@/components/dashboard/feed'
import {
  ChoresToday,
  type ChoreRole,
  type ChoreToday,
  type UpkeepItem,
} from '@/components/home/chores-today'

type MemberRow = {
  user_id: string
  role: 'owner' | 'partner'
  profiles: { display_name: string | null; email: string } | null
}

type ChoreRowLite = {
  id: string
  name: string
  next_due: string | null
  last_done_at: string | null
  assignee_user_id: string | null
}

type MaintenanceRowLite = {
  id: string
  item: string
  next_due: string | null
}

/** First grapheme of a member's name (fallback email), uppercased. */
function initialOf(member: MemberRow): string {
  const name = member.profiles?.display_name || member.profiles?.email || '?'
  return name.trim().charAt(0).toUpperCase() || '?'
}

/** "Due in N days" / "Due today" / "Due tomorrow" / "Overdue" for the UPKEEP card. */
function describeUpkeepDue(nextDue: string | null, today: string): string {
  if (!nextDue) return 'No due date'
  const due = new Date(`${nextDue.slice(0, 10)}T00:00:00Z`)
  const now = new Date(`${today}T00:00:00Z`)
  if (Number.isNaN(due.getTime())) return 'No due date'
  const diff = Math.round((due.getTime() - now.getTime()) / 86_400_000)
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  return `Due in ${diff} days`
}

/**
 * House — "Focus Timeline" redesign. A scannable feed: the chores due today
 * (each a tappable checkbox row with the assignee's avatar + a live "N left"
 * counter) and the nearest UPKEEP (maintenance) reminder. The interactive list
 * is a client component; this server component loads the real data.
 */
export default async function HousePage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const today = todayIsoJhb()

  const [{ data: memberRows }, { data: choreRows }, { data: maintRows }] = await Promise.all([
    supabase
      .from('household_members')
      .select('user_id, role, profiles ( display_name, email )')
      .eq('household_id', householdId)
      .returns<MemberRow[]>(),
    // Chores due today or overdue (next_due ≤ today).
    supabase
      .from('chores')
      .select('id, name, next_due, last_done_at, assignee_user_id')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .not('next_due', 'is', null)
      .lte('next_due', today)
      .order('next_due', { ascending: true })
      .returns<ChoreRowLite[]>(),
    // Nearest upcoming maintenance reminder.
    supabase
      .from('maintenance_reminders')
      .select('id, item, next_due')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .not('next_due', 'is', null)
      .order('next_due', { ascending: true })
      .limit(1)
      .returns<MaintenanceRowLite[]>(),
  ])

  // Member lookup: initial + role per user, for the assignee avatars.
  const memberById: Record<string, { initial: string; role: ChoreRole }> = {}
  for (const m of memberRows ?? []) {
    memberById[m.user_id] = { initial: initialOf(m), role: m.role }
  }

  // Chores due today/overdue, excluding any already ticked off today.
  const chores: ChoreToday[] = (choreRows ?? [])
    .filter((c) => !(c.last_done_at != null && todayIsoJhb(new Date(c.last_done_at)) === today))
    .map((c) => {
      const member = c.assignee_user_id ? memberById[c.assignee_user_id] : undefined
      return {
        id: c.id,
        name: c.name,
        initial: member?.initial ?? null,
        role: member?.role ?? null,
      }
    })

  const maint = maintRows?.[0]
  const upkeep: UpkeepItem | null = maint
    ? { item: maint.item, dueLabel: describeUpkeepDue(maint.next_due, today) }
    : null

  return (
    <main className="mx-auto max-w-xl" style={{ padding: '8px 22px 120px' }}>
      <ScreenHeader title="House" />

      <ChoresToday chores={chores} upkeep={upkeep} />

      {/* Links to the other House sections. */}
      <nav className="mt-8 flex flex-wrap gap-2">
        {HOME_SECTIONS.filter((s) => s.href !== '/home').map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-full px-3.5 py-2 text-sm font-medium"
            style={{
              background: '#FFFDF9',
              border: '1px solid #E8DFCE',
              color: '#5F8160',
            }}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </main>
  )
}
