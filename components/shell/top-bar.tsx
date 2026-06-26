import Link from 'next/link'
import { signOutAction } from '@/app/(app)/settings/actions'
import { createClient } from '@/lib/supabase/server'
import { listNotifications, unreadCount } from '@/lib/notifications'
import { AvatarMenu } from './avatar-menu'
import { NotificationBell } from './notification-bell'

/**
 * Top bar — household name (left), notification bell and avatar/menu (Settings,
 * Sign out) on the right. Spec §6.
 *
 * Server component: it loads the current user's recent notifications + unread
 * count and hands them to the (client) bell as initial state. The bell then
 * keeps itself fresh via Supabase Realtime + on-open refetch.
 */
export async function TopBar({ householdName }: { householdName: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [initialItems, initialUnread] = user
    ? await Promise.all([listNotifications(supabase, { limit: 20 }), unreadCount(supabase)])
    : [[], 0]

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-cream-300 bg-cream-100/95 px-4 backdrop-blur md:pl-56">
      <Link href="/dashboard" className="font-serif text-lg text-terracotta-700">
        {householdName}
      </Link>

      <div className="flex items-center gap-1">
        {user && (
          <NotificationBell
            userId={user.id}
            initialItems={initialItems}
            initialUnread={initialUnread}
          />
        )}

        <AvatarMenu signOutAction={signOutAction} />
      </div>
    </header>
  )
}
