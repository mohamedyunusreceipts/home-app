'use client'

import { useState, useTransition } from 'react'
import { useShell } from '@/components/shell/shell-context'
import { completeLesson } from '../actions'

/**
 * Shared "Mark level complete" control for the basics/tajwīd lessons. Calls the
 * completeLesson server action (idempotent) and reflects a done state.
 */
export function MarkComplete({
  lessonId,
  initialDone,
}: {
  lessonId: string
  initialDone: boolean
}) {
  const { showToast } = useShell()
  const [done, setDone] = useState(initialDone)
  const [pending, startTransition] = useTransition()

  function mark() {
    if (done) return
    startTransition(async () => {
      const result = await completeLesson(lessonId)
      if ('error' in result) {
        showToast(result.error)
      } else {
        setDone(true)
        showToast('Level marked complete')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={mark}
      disabled={pending || done}
      aria-pressed={done}
      className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold transition-colors disabled:opacity-70 ${
        done
          ? 'border border-[#7A9B7A] bg-[#F1F5F1] text-[#3B523C]'
          : 'bg-[#7A9B7A] text-cream-50 hover:opacity-90'
      }`}
    >
      {done ? (
        <>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Completed
        </>
      ) : pending ? (
        'Saving…'
      ) : (
        'Mark level complete'
      )}
    </button>
  )
}
