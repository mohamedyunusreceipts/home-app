'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useShell } from '@/components/shell/shell-context'
import { SURAHS, type HifzStatus } from '@/lib/quran/surahs'
import { setHifzStatus, markRevisedToday } from '../actions'

export interface HifzState {
  status: HifzStatus
  lastRevisedOn: string | null
}

/** Format an ISO date (YYYY-MM-DD) as "6 Jul 2026", or a fallback. */
function formatRevised(iso: string | null): string {
  if (!iso) return 'Not revised yet'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 'Not revised yet'
  return `Revised ${d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}

type Bucket = 'memorised' | 'learning' | 'not-started'

export function HifzClient({ initial }: { initial: Record<number, HifzState> }) {
  const { showToast } = useShell()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<Record<number, HifzState>>(initial)

  const buckets = useMemo(() => {
    const memorised: number[] = []
    const learning: number[] = []
    const notStarted: number[] = []
    for (const surah of SURAHS) {
      const s = state[surah.number]?.status
      if (s === 'memorised') memorised.push(surah.number)
      else if (s === 'learning') learning.push(surah.number)
      else notStarted.push(surah.number)
    }
    return { memorised, learning, notStarted }
  }, [state])

  function changeStatus(surahNumber: number, next: HifzStatus) {
    const prev = state[surahNumber] ?? null
    setState((s) => ({
      ...s,
      [surahNumber]: { status: next, lastRevisedOn: s[surahNumber]?.lastRevisedOn ?? null },
    }))
    startTransition(async () => {
      const result = await setHifzStatus(surahNumber, next)
      if ('error' in result) {
        setState((s) => {
          const copy = { ...s }
          if (prev) copy[surahNumber] = prev
          else delete copy[surahNumber]
          return copy
        })
        showToast(result.error)
      } else {
        showToast(next === 'memorised' ? 'Marked as memorised' : 'Marked as learning')
      }
    })
  }

  function revise(surahNumber: number) {
    const today = new Date().toISOString().slice(0, 10)
    const prev = state[surahNumber] ?? null
    setState((s) => ({
      ...s,
      [surahNumber]: {
        status: s[surahNumber]?.status ?? 'learning',
        lastRevisedOn: today,
      },
    }))
    startTransition(async () => {
      const result = await markRevisedToday(surahNumber)
      if ('error' in result) {
        setState((s) => {
          const copy = { ...s }
          if (prev) copy[surahNumber] = prev
          else delete copy[surahNumber]
          return copy
        })
        showToast(result.error)
      } else {
        showToast('Revision recorded for today')
      }
    })
  }

  function surahName(n: number): { english: string; arabic: string } {
    const s = SURAHS.find((x) => x.number === n)
    return { english: s?.englishName ?? `Sūrah ${n}`, arabic: s?.name ?? '' }
  }

  function renderRow(surahNumber: number, bucket: Bucket) {
    const names = surahName(surahNumber)
    const entry = state[surahNumber]
    return (
      <li
        key={surahNumber}
        className="rounded-[16px] border border-cream-300 bg-cream-50 px-[16px] py-[13px]"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#F1F5F1] font-serif text-[13px] font-semibold text-[#3B523C]">
            {surahNumber}
          </span>
          <div className="min-w-0 flex-1">
            <Link
              href={`/quran/read/${surahNumber}`}
              className="text-[15px] font-semibold text-terracotta-900 hover:underline"
            >
              {names.english}
            </Link>
            {bucket !== 'not-started' ? (
              <p className="mt-0.5 text-[12px] text-[#8a7163]">
                {formatRevised(entry?.lastRevisedOn ?? null)}
              </p>
            ) : null}
          </div>
          <span
            className="shrink-0 font-arabic text-[18px] text-terracotta-800"
            lang="ar"
            dir="rtl"
          >
            {names.arabic}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {bucket !== 'memorised' ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => changeStatus(surahNumber, 'memorised')}
              className="rounded-full border border-[#7A9B7A] bg-[#F1F5F1] px-3 py-1.5 text-[12px] font-semibold text-[#3B523C] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Mark memorised
            </button>
          ) : null}
          {bucket !== 'learning' ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => changeStatus(surahNumber, 'learning')}
              className="rounded-full border border-cream-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#8a7163] transition-colors hover:bg-cream-100 disabled:opacity-60"
            >
              {bucket === 'memorised' ? 'Back to learning' : 'Start learning'}
            </button>
          ) : null}
          {bucket !== 'not-started' ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => revise(surahNumber)}
              className="rounded-full border border-terracotta-300 bg-[#FBF2EE] px-3 py-1.5 text-[12px] font-semibold text-terracotta-600 transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Revised today
            </button>
          ) : null}
        </div>
      </li>
    )
  }

  const total = SURAHS.length

  const section = (title: string, bucket: Bucket, ids: number[]) =>
    ids.length > 0 ? (
      <section>
        <h2 className="mt-6 mb-3 text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
          {title} · {ids.length}
        </h2>
        <ul className="space-y-2">{ids.map((n) => renderRow(n, bucket))}</ul>
      </section>
    ) : null

  return (
    <div>
      {/* Summary tiles. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[16px] border border-[#DCE7DC] bg-[#F1F5F1] px-3 py-4 text-center">
          <p className="font-serif text-[26px] font-semibold text-[#3B523C]">
            {buckets.memorised.length}
          </p>
          <p className="text-[11px] font-medium text-sage-600">Memorised</p>
        </div>
        <div className="rounded-[16px] border border-terracotta-100 bg-[#FBF2EE] px-3 py-4 text-center">
          <p className="font-serif text-[26px] font-semibold text-terracotta-600">
            {buckets.learning.length}
          </p>
          <p className="text-[11px] font-medium text-terracotta-500">Learning</p>
        </div>
        <div className="rounded-[16px] border border-cream-300 bg-cream-50 px-3 py-4 text-center">
          <p className="font-serif text-[26px] font-semibold text-[#8a7163]">
            {buckets.notStarted.length}
          </p>
          <p className="text-[11px] font-medium text-[#8a7163]">To start</p>
        </div>
      </div>
      <p className="mt-2 text-center text-[12px] text-[#8a7163]">
        {buckets.memorised.length} of {total} sūrahs memorised
      </p>

      {section('Memorised', 'memorised', buckets.memorised)}
      {section('Learning', 'learning', buckets.learning)}
      {section('Not started', 'not-started', buckets.notStarted)}
    </div>
  )
}
