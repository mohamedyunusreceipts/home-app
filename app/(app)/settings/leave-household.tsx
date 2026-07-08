'use client'

import { useState } from 'react'
import { useShell } from '@/components/shell/shell-context'
import { leaveHouseholdAction } from './actions'

/**
 * Low-key destructive "Leave household" control for Settings. Two-tap confirm:
 * the first tap reveals a warning + explicit Confirm/Cancel, so leaving (which
 * can delete shared data) is never a single accidental tap. On confirm we call
 * leaveHouseholdAction, which redirects to /setup on success. This doubles as
 * "switch household" — from /setup you can join another via its invite input.
 */
export function LeaveHousehold() {
  const { showToast } = useShell()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleLeave() {
    setBusy(true)
    // On success the action redirects and this unmounts; we only reach the lines
    // below if the RPC returned an error.
    const result = await leaveHouseholdAction()
    if (result && 'error' in result) {
      showToast('Could not leave household')
      setBusy(false)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-[16px] px-4 py-3.5 text-sm font-semibold text-terracotta-600 transition-colors hover:bg-[#FBF2EE]"
      >
        Leave household
      </button>
    )
  }

  return (
    <section className="rounded-[16px] border border-[#F4DDD2] bg-[#FBF2EE] p-4">
      <p className="text-sm text-[#974F38]">
        You&apos;ll leave this household and lose access to its shared data. If you&apos;re the last
        member, the household and its data are deleted.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleLeave}
          disabled={busy}
          className="h-11 flex-1 rounded-[12px] bg-terracotta-600 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Leaving…' : 'Yes, leave'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="h-11 flex-1 rounded-[12px] border border-[#E8DFCE] bg-[#FFFDF9] px-4 text-sm font-semibold text-[#3F2118] transition-colors hover:bg-[#FAF6EF] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
