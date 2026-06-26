'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  type NotificationRow,
} from '@/lib/notifications'

/** Fetch the current user's recent notifications + unread count (for the bell). */
export async function fetchNotificationsAction(
  limit = 20,
): Promise<{ items: NotificationRow[]; unread: number }> {
  const supabase = await createClient()
  const [items, unread] = await Promise.all([
    listNotifications(supabase, { limit }),
    unreadCount(supabase),
  ])
  return { items, unread }
}

/** Mark a set of notifications read, then refresh shell + list. */
export async function markReadAction(ids: string[]): Promise<void> {
  const supabase = await createClient()
  await markRead(supabase, ids)
  revalidatePath('/notifications')
}

/** Mark every notification read, then refresh shell + list. */
export async function markAllReadAction(): Promise<void> {
  const supabase = await createClient()
  await markAllRead(supabase)
  revalidatePath('/notifications')
}
