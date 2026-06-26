import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side helpers for in-app notifications (spec: infra-notifications).
 *
 * All reads/writes go through a Supabase client whose RLS scopes
 * `public.notifications` to `user_id = auth.uid()`. The helpers stay thin: they
 * never re-implement the access check — they rely on the row-level policy.
 *
 * `createNotification` is the one exception: it inserts a row for an arbitrary
 * `userId`, so it must be called with a client that is authorised to write that
 * row (i.e. the recipient's own session, or a service-role client when fanning
 * out server-side). RLS will reject a cross-user insert from a normal session.
 */

export interface NotificationRow {
  id: string
  household_id: string
  user_id: string
  kind: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export interface CreateNotificationInput {
  householdId: string
  userId: string
  kind: string
  title: string
  body?: string
  link?: string
}

const DEFAULT_LIMIT = 20

/** Insert a single notification row and return it. */
export async function createNotification(
  supabase: SupabaseClient,
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      household_id: input.householdId,
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })
    .select()
    .single<NotificationRow>()

  if (error || !data) {
    throw new Error(`createNotification failed: ${error?.message ?? 'no row returned'}`)
  }
  return data
}

/** Current user's notifications, newest first. RLS scopes to the user. */
export async function listNotifications(
  supabase: SupabaseClient,
  options: { limit?: number } = {},
): Promise<NotificationRow[]> {
  const limit = options.limit ?? DEFAULT_LIMIT
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<NotificationRow[]>()

  if (error) {
    throw new Error(`listNotifications failed: ${error.message}`)
  }
  return data ?? []
}

/** Count of the current user's unread notifications (`read_at is null`). */
export async function unreadCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) {
    throw new Error(`unreadCount failed: ${error.message}`)
  }
  return count ?? 0
}

/** Mark the given notification ids as read (no-op for ids the user can't see). */
export async function markRead(
  supabase: SupabaseClient,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null)

  if (error) {
    throw new Error(`markRead failed: ${error.message}`)
  }
}

/** Mark all of the current user's unread notifications as read. */
export async function markAllRead(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)

  if (error) {
    throw new Error(`markAllRead failed: ${error.message}`)
  }
}
