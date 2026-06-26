'use client'

import { useState } from 'react'
import { useShell } from '@/components/shell/shell-context'
import { generateInviteAction } from './actions'

/**
 * YOUR HOUSEHOLD card for the Focus Timeline Settings screen.
 *
 * Shows overlapping member avatars + household name + a "Sam & Mia"-style member
 * line, with an Invite button on the right. Invite reuses `generateInviteAction`
 * (single-use 24h link), copies the join URL to the clipboard, and confirms via
 * the shell toast ("Invite link copied"). The existing token (if any) is passed
 * in so a fresh link isn't minted on every copy.
 */
export function HouseholdCard({
  householdName,
  memberNames,
  appOrigin,
  initialToken,
  canInvite,
}: {
  householdName: string
  memberNames: string[]
  appOrigin: string
  initialToken: string | null
  canInvite: boolean
}) {
  const { showToast } = useShell()
  const [token, setToken] = useState<string | null>(initialToken)
  const [busy, setBusy] = useState(false)

  // Member-line label, e.g. "Sam & Mia" or just "Sam".
  const membersLabel =
    memberNames.length === 0
      ? 'Just you'
      : memberNames.length === 1
        ? memberNames[0]
        : memberNames.slice(0, -1).join(', ') + ' & ' + memberNames[memberNames.length - 1]

  // Up to two avatars: terracotta then sage, matching the redesign.
  const avatarColors = ['#C77B5C', '#7A9B7A']
  const avatars = memberNames.slice(0, 2).map((name, i) => ({
    initial: (name.trim()[0] ?? '?').toUpperCase(),
    bg: avatarColors[i] ?? '#7A9B7A',
  }))

  async function handleInvite() {
    setBusy(true)
    try {
      let inviteToken = token
      if (!inviteToken) {
        const result = await generateInviteAction()
        if ('error' in result) {
          showToast('Could not create invite link')
          return
        }
        inviteToken = result.token
        setToken(inviteToken)
      }
      const url = `${appOrigin}/join/${inviteToken}`
      await navigator.clipboard.writeText(url)
      showToast('Invite link copied')
    } catch {
      showToast('Could not copy invite link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[20px] border border-[#E8DFCE] bg-[#FFFDF9] p-[18px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#7A9B7A]">
        Your household
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex shrink-0 items-center">
          {avatars.map((a, i) => (
            <span
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#FAF6EF] text-sm font-semibold text-white"
              style={{ backgroundColor: a.bg, marginLeft: i === 0 ? 0 : -11 }}
            >
              {a.initial}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#3F2118]">{householdName}</p>
          <p className="truncate text-[13px] text-[#8a7163]">{membersLabel}</p>
        </div>
        {canInvite ? (
          <button
            type="button"
            onClick={handleInvite}
            disabled={busy}
            className="shrink-0 rounded-full border border-[#F4DDD2] bg-[#FBF2EE] px-4 py-1.5 text-[13px] font-semibold text-[#974F38] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Copying…' : 'Invite'}
          </button>
        ) : null}
      </div>
    </section>
  )
}
