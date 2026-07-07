'use client'

import { useEffect, useRef, useState } from 'react'
import { useShell } from '@/components/shell/shell-context'
import { audioUrl, DEFAULT_RECITER } from '@/lib/quran/surahs'
import type { TajweedRule } from '@/lib/quran/tajweed'

/** An example enriched (on the server) with the ayah's Arabic text + surah name. */
export interface EnrichedExample {
  surah: number
  ayah: number
  note: string
  arabic: string
  surahName: string
}

export interface EnrichedRule extends Omit<TajweedRule, 'examples'> {
  examples: EnrichedExample[]
}

/** A single play/stop key identifying an example. */
function exKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`
}

export function TajweedClient({ rules }: { rules: EnrichedRule[] }) {
  const { showToast } = useShell()
  const [openId, setOpenId] = useState<string | null>(rules[0]?.id ?? null)
  const [playing, setPlaying] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = new Audio()
    audioRef.current = el
    const clear = () => setPlaying(null)
    const onError = () => {
      setPlaying(null)
      showToast('Could not play the recitation.')
    }
    el.addEventListener('ended', clear)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('ended', clear)
      el.removeEventListener('error', onError)
      el.pause()
      audioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleAudio(surah: number, ayah: number) {
    const el = audioRef.current
    if (!el) return
    const key = exKey(surah, ayah)
    if (playing === key) {
      el.pause()
      el.currentTime = 0
      setPlaying(null)
      return
    }
    el.src = audioUrl(surah, ayah, DEFAULT_RECITER)
    setPlaying(key)
    void el.play().catch(() => {
      setPlaying(null)
      showToast('Could not play the recitation.')
    })
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => {
        const open = openId === rule.id
        return (
          <div
            key={rule.id}
            className="overflow-hidden rounded-[16px] border border-cream-300 bg-cream-50"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : rule.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-3 px-[18px] py-[14px] text-left transition-colors hover:bg-cream-100"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold text-terracotta-900">
                    {rule.name}
                  </p>
                  {rule.arabicName ? (
                    <span
                      className="font-arabic text-[16px] text-[#8a7163]"
                      dir="rtl"
                      lang="ar"
                    >
                      {rule.arabicName}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-[#8a7163]">
                  {rule.summary}
                </p>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C8B79C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {open ? (
              <div className="border-t border-[#F2EBDF] px-[18px] pb-[16px] pt-3">
                <p className="text-[13px] leading-relaxed text-terracotta-900">
                  {rule.detail}
                </p>

                <p className="mt-4 text-[11px] font-semibold tracking-[0.07em] text-sage-500 uppercase">
                  Examples
                </p>
                <div className="mt-2 space-y-2">
                  {rule.examples.map((ex) => {
                    const key = exKey(ex.surah, ex.ayah)
                    const isPlaying = playing === key
                    return (
                      <div
                        key={key}
                        className="rounded-[12px] border border-cream-300 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => toggleAudio(ex.surah, ex.ayah)}
                            aria-label={
                              isPlaying
                                ? `Stop ${ex.surahName} ${ex.ayah}`
                                : `Play ${ex.surahName} ${ex.ayah}`
                            }
                            className="mt-1 flex size-[32px] shrink-0 items-center justify-center rounded-full bg-[#F1F5F1] text-[#3B523C] transition-colors hover:bg-[#DCE7DC]"
                          >
                            {isPlaying ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <rect x="6" y="5" width="4" height="14" rx="1" />
                                <rect x="14" y="5" width="4" height="14" rx="1" />
                              </svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                          <p
                            className="flex-1 text-right font-arabic text-[24px] leading-[2] text-terracotta-900"
                            dir="rtl"
                            lang="ar"
                          >
                            {ex.arabic}
                          </p>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-[#F2EBDF] pt-2">
                          <p className="text-[11px] font-medium text-sage-600">
                            {ex.surahName} · {ex.surah}:{ex.ayah}
                          </p>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-[#8a7163]">
                          {ex.note}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
