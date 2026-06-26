'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  fetchNotificationsAction,
  markAllReadAction,
} from '@/app/(app)/notifications/actions'
import type { NotificationRow } from '@/lib/notifications'

interface NotificationBellProps {
  userId: string
  initialItems: NotificationRow[]
  initialUnread: number
}

/** Format an ISO timestamp as a short relative time ("3m", "2h", "5d"). */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (Number.isNaN(diff)) return ''
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d`
  return new Date(iso).toLocaleDateString()
}

/**
 * Notification bell — unread badge + dropdown of recent notifications.
 *
 * Live updates: subscribes to Postgres changes on `public.notifications` for the
 * current user via Supabase Realtime. If the household's Realtime publication is
 * not enabled for this table, the subscription simply never fires — the dropdown
 * still refetches every time it is opened, so it stays correct either way.
 */
export function NotificationBell({
  userId,
  initialItems,
  initialUnread,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>(initialItems)
  const [unread, setUnread] = useState(initialUnread)
  const containerRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const { items: next, unread: nextUnread } = await fetchNotificationsAction()
    setItems(next)
    setUnread(nextUnread)
  }, [])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Realtime subscription — refetch on any change to this user's notifications.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  async function handleOpen() {
    const next = !open
    setOpen(next)
    if (next) await refresh()
  }

  async function handleMarkAll() {
    await markAllReadAction()
    await refresh()
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        title="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleOpen}
        className="relative text-sage-700"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[10px] font-semibold leading-4 text-cream-50"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-cream-300 bg-cream-50 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-cream-300 px-4 py-2">
            <span className="text-sm font-medium text-sage-800">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-terracotta-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-sage-600">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul>
                {items.map((n) => {
                  const unreadRow = n.read_at === null
                  const inner = (
                    <div
                      className={`block px-4 py-3 ${
                        unreadRow ? 'bg-cream-100' : ''
                      } hover:bg-cream-100`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-sage-800">
                          {n.title}
                        </span>
                        <span className="shrink-0 text-xs text-sage-500">
                          {relativeTime(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="mt-0.5 text-sm text-sage-600">{n.body}</p>
                      )}
                    </div>
                  )
                  return (
                    <li key={n.id} className="border-b border-cream-200 last:border-b-0">
                      {n.link ? (
                        <Link href={n.link} onClick={() => setOpen(false)}>
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-cream-300 px-4 py-2 text-center text-sm text-terracotta-700 hover:bg-cream-100"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
