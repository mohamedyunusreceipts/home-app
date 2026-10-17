'use client'

import { useState, useTransition } from 'react'
import { useShell } from '@/components/shell/shell-context'
import type { FeedKind } from '@/lib/mba/sync-calendar'
import { saveCalendarFeed, syncCalendarsNow, type SyncActionResult } from './actions'
import { Card, Icon, ICONS, SectionTitle } from './parts'
import type { FeedVM } from './types'

const FEEDS: {
  kind: FeedKind
  label: string
  blurb: string
  placeholder: string
  steps: string[]
  note?: string
}[] = [
  {
    kind: 'lms',
    label: 'Amathuba calendar',
    blurb: 'Assignment due dates, quiz windows and course events.',
    placeholder: 'https://amathuba.uct.ac.za/…/feed.ics?token=…',
    steps: [
      'Open Amathuba and go to Calendar (Home page → Calendar, or inside any course).',
      'Choose “Subscribe” (bottom of the calendar, or the ⋯ menu).',
      'Pick “All Courses”, then copy the link it shows.',
      'Paste it below and tap Connect.',
    ],
    note: 'If there is no Subscribe option, UCT has switched calendar feeds off for Amathuba.',
  },
  {
    kind: 'mail',
    label: 'UCT Outlook calendar',
    blurb: 'Group team meetings and lecture invites — with their Teams join links.',
    placeholder: 'https://outlook.office365.com/owa/calendar/…/calendar.ics',
    steps: [
      'Open Outlook on the web (outlook.office.com) signed in with your UCT account.',
      'Go to Settings ⚙ → Calendar → Shared calendars.',
      'Under “Publish a calendar”, choose your Calendar and “Can view all details”, then Publish.',
      'Copy the ICS link (not the HTML one), paste it below and tap Connect.',
    ],
    note: 'If “Publish a calendar” is missing, UCT has disabled publishing for student mailboxes.',
  },
]

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function describe(r: SyncActionResult): string {
  if ('error' in r) return r.error
  const parts = []
  if (r.deadlines) parts.push(`${r.deadlines} deadline${r.deadlines === 1 ? '' : 's'}`)
  if (r.events) parts.push(`${r.events} event${r.events === 1 ? '' : 's'}`)
  return parts.length ? `Synced ${parts.join(' and ')}` : 'Synced — nothing new found'
}

export function FeedsCard({ feeds }: { feeds: FeedVM[] }) {
  const { showToast } = useShell()
  const [pending, startTransition] = useTransition()
  const anyConnected = feeds.length > 0

  function syncNow() {
    startTransition(async () => showToast(describe(await syncCalendarsNow())))
  }

  return (
    <Card>
      <SectionTitle
        action={
          anyConnected ? (
            <button
              type="button"
              onClick={syncNow}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full border border-cream-300 bg-white px-3 py-1 text-[12px] font-semibold text-sage-600 hover:bg-cream-100 disabled:opacity-60"
            >
              <Icon d={ICONS.refresh} size={13} /> {pending ? 'Syncing…' : 'Sync now'}
            </button>
          ) : null
        }
      >
        Connected calendars
      </SectionTitle>
      <div className="mt-3 divide-y divide-[#F2EBDF]">
        {FEEDS.map((f) => (
          <FeedRow key={f.kind} def={f} feed={feeds.find((x) => x.kind === f.kind)} />
        ))}
      </div>
      <p className="mt-3 text-[12px] text-[#8a7163]">
        These links are private — anyone with one can read that calendar. They&apos;re stored for your
        account only, synced every few hours, and you can disconnect at any time.
      </p>
    </Card>
  )
}

function FeedRow({ def, feed }: { def: (typeof FEEDS)[number]; feed?: FeedVM }) {
  const { showToast } = useShell()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(!feed)
  const [url, setUrl] = useState('')

  function connect(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const r = await saveCalendarFeed(def.kind, url)
      showToast(describe(r))
      if (!('error' in r)) {
        setUrl('')
        setEditing(false)
      }
    })
  }

  function disconnect() {
    startTransition(async () => {
      const r = await saveCalendarFeed(def.kind, '')
      showToast('error' in r ? r.error : `${def.label} disconnected`)
      if (!('error' in r)) setEditing(true)
    })
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-[34px] shrink-0 items-center justify-center rounded-xl bg-[#F1F5F1] text-sage-600">
          <Icon d={def.kind === 'lms' ? ICONS.book : ICONS.calendar} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-terracotta-900">{def.label}</p>
          <p className="text-[12px] text-[#8a7163]">{def.blurb}</p>
          {feed ? (
            <p className={`mt-1 text-[12px] ${feed.lastSyncError ? 'text-[#A63D2F]' : 'text-sage-600'}`}>
              {feed.lastSyncError
                ? `Sync problem: ${feed.lastSyncError}`
                : `Connected · ${feed.host} · synced ${ago(feed.lastSyncedAt)}${
                    feed.lastSyncCount != null ? ` · ${feed.lastSyncCount} items` : ''
                  }`}
            </p>
          ) : null}
        </div>
      </div>

      {feed && !editing ? (
        <div className="mt-2 ml-[46px] flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-semibold text-sage-600 hover:underline">
            Replace link
          </button>
          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            className="text-[13px] font-semibold text-[#A63D2F] hover:underline disabled:opacity-60"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-2.5 ml-[46px]">
          <details className="group">
            <summary className="cursor-pointer text-[13px] font-semibold text-sage-600">
              How do I get this link?
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12.5px] text-[#6B5547]">
              {def.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {def.note ? <p className="mt-1.5 text-[12px] text-[#8a7163]">{def.note}</p> : null}
          </details>
          <form onSubmit={connect} className="mt-2 flex gap-2">
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={def.placeholder}
              aria-label={`${def.label} link`}
              className="min-w-0 flex-1 rounded-[12px] border border-cream-300 bg-white px-3 py-2 text-[14px] text-terracotta-900"
              required
            />
            <button
              type="submit"
              disabled={pending || !url.trim()}
              className="shrink-0 rounded-full bg-terracotta-400 px-4 py-2 text-[13px] font-semibold text-cream-50 hover:bg-terracotta-500 disabled:opacity-60"
            >
              {pending ? '…' : 'Connect'}
            </button>
          </form>
          {feed ? (
            <button type="button" onClick={() => setEditing(false)} className="mt-1.5 text-[12px] text-[#8a7163] hover:underline">
              Cancel
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
