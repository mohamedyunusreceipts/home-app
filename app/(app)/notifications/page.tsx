import Link from 'next/link'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { listNotifications, type NotificationRow } from '@/lib/notifications'
import { MarkAllReadButton } from './mark-all-read-button'

export const metadata = {
  title: 'Notifications',
}

/** Format an ISO timestamp as an absolute, locale-friendly date-time. */
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function NotificationItem({ n }: { n: NotificationRow }) {
  const unread = n.read_at === null
  const inner = (
    <div
      className={`rounded-lg border border-cream-300 px-4 py-3 ${
        unread ? 'bg-cream-100' : 'bg-cream-50'
      } ${n.link ? 'transition-colors hover:border-terracotta-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-sage-800">
          {unread && (
            <span
              aria-hidden="true"
              className="inline-block size-2 shrink-0 rounded-full bg-terracotta-500"
            />
          )}
          {n.title}
        </span>
        <time
          dateTime={n.created_at}
          className="shrink-0 text-xs text-sage-500"
        >
          {formatTime(n.created_at)}
        </time>
      </div>
      {n.body && <p className="mt-1 text-sm text-sage-600">{n.body}</p>}
    </div>
  )

  return n.link ? (
    <Link href={n.link} className="block">
      {inner}
    </Link>
  ) : (
    inner
  )
}

/** Full notifications list (spec §6). Server component; RLS scopes to the user. */
export default async function NotificationsPage() {
  await requireHousehold()
  const supabase = await createClient()
  const items = await listNotifications(supabase, { limit: 100 })
  const hasUnread = items.some((n) => n.read_at === null)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-serif text-2xl text-terracotta-700">Notifications</h1>
        <MarkAllReadButton disabled={!hasUnread} />
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-cream-300 px-4 py-12 text-center text-sm text-sage-600">
          You&apos;re all caught up. New notifications will show up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationItem n={n} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
