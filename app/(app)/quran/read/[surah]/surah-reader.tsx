'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useShell } from '@/components/shell/shell-context'
import {
  RECITERS,
  DEFAULT_RECITER,
  audioUrl,
  type Surah,
  type HifzStatus,
} from '@/lib/quran/surahs'
import { setHifzStatus } from '../../actions'

/** Convert a Western integer to Arabic-Indic digits (٠١٢…) for the ayah marker. */
function toArabicDigits(n: number): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return String(n)
    .split('')
    .map((d) => map[Number(d)] ?? d)
    .join('')
}

export function SurahReader({
  surah,
  initialStatus,
}: {
  surah: Surah
  initialStatus: HifzStatus | null
}) {
  const { showToast } = useShell()
  const [reciter, setReciter] = useState(DEFAULT_RECITER)
  const [status, setStatus] = useState<HifzStatus | null>(initialStatus)
  const [pending, startTransition] = useTransition()

  // The ayah currently playing (surah-relative number), or null when stopped.
  const [playingAyah, setPlayingAyah] = useState<number | null>(null)
  // Whether we're auto-advancing through the whole surah.
  const sequentialRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Lazily create the shared <audio> element on the client.
  useEffect(() => {
    const el = new Audio()
    audioRef.current = el
    const onEnded = () => {
      if (sequentialRef.current && playingAyahRef.current != null) {
        const next = playingAyahRef.current + 1
        if (next <= surah.ayahs.length) {
          play(next, true)
          return
        }
      }
      sequentialRef.current = false
      setPlayingAyah(null)
    }
    const onError = () => {
      sequentialRef.current = false
      setPlayingAyah(null)
      showToast('Could not play the recitation.')
    }
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
      el.pause()
      audioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah.number, reciter])

  // Keep a ref in sync so the audio "ended" handler reads the latest value.
  const playingAyahRef = useRef<number | null>(null)
  useEffect(() => {
    playingAyahRef.current = playingAyah
  }, [playingAyah])

  function play(ayahNumber: number, sequential: boolean) {
    const el = audioRef.current
    if (!el) return
    sequentialRef.current = sequential
    el.src = audioUrl(surah.number, ayahNumber, reciter)
    setPlayingAyah(ayahNumber)
    void el.play().catch(() => {
      sequentialRef.current = false
      setPlayingAyah(null)
      showToast('Could not play the recitation.')
    })
  }

  function stop() {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    sequentialRef.current = false
    setPlayingAyah(null)
  }

  function toggleAyah(ayahNumber: number) {
    if (playingAyah === ayahNumber && !sequentialRef.current) {
      stop()
    } else {
      play(ayahNumber, false)
    }
  }

  function playWholeSurah() {
    if (sequentialRef.current) {
      stop()
    } else {
      play(1, true)
    }
  }

  function updateStatus(next: HifzStatus) {
    const optimisticPrev = status
    setStatus(next)
    startTransition(async () => {
      const result = await setHifzStatus(surah.number, next)
      if ('error' in result) {
        setStatus(optimisticPrev)
        showToast(result.error)
      } else {
        showToast(next === 'memorised' ? 'Marked as memorised' : 'Marked as learning')
      }
    })
  }

  const isSequential = sequentialRef.current

  return (
    <div className="space-y-3">
      {/* Controls: reciter + play whole surah + hifz status. */}
      <section className="rounded-[20px] border border-cream-300 bg-cream-50 p-[18px]">
        <label className="block">
          <span className="text-[12px] font-medium text-[#8a7163]">Reciter</span>
          <select
            value={reciter}
            onChange={(e) => {
              stop()
              setReciter(e.target.value)
            }}
            className="mt-1 w-full rounded-[12px] border border-cream-300 bg-white px-3 py-2.5 text-[15px] text-terracotta-900"
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={playWholeSurah}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-4 py-2 text-[13px] font-semibold text-sage-600 transition-colors hover:bg-cream-100"
        >
          {isSequential ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {isSequential ? 'Stop' : 'Play whole sūrah'}
        </button>

        <div className="mt-4 border-t border-[#F2EBDF] pt-4">
          <span className="text-[12px] font-medium text-[#8a7163]">Memorisation</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['learning', 'memorised'] as const).map((s) => {
              const active = status === s
              return (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => updateStatus(s)}
                  aria-pressed={active}
                  className={`rounded-[12px] border px-3 py-2.5 text-[14px] font-semibold capitalize transition-colors disabled:opacity-60 ${
                    active
                      ? s === 'memorised'
                        ? 'border-[#7A9B7A] bg-[#F1F5F1] text-[#3B523C]'
                        : 'border-terracotta-300 bg-[#FBF2EE] text-terracotta-600'
                      : 'border-cream-300 bg-white text-[#8a7163]'
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Basmala heading (rendered when bismillah=true). */}
      {surah.bismillah ? (
        <div className="rounded-[20px] border border-cream-300 bg-cream-50 px-[18px] py-5 text-center">
          <p
            className="font-arabic text-[26px] leading-[1.9] text-terracotta-900"
            dir="rtl"
            lang="ar"
          >
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
          <p className="mt-1 text-[12px] text-[#8a7163]">
            In the name of Allah, the Entirely Merciful, the Especially Merciful.
          </p>
        </div>
      ) : null}

      {/* Ayahs. */}
      {surah.ayahs.map((ayah) => {
        const isPlaying = playingAyah === ayah.number
        return (
          <article
            key={ayah.number}
            className={`rounded-[20px] border bg-cream-50 p-[18px] ${
              isPlaying ? 'border-terracotta-300' : 'border-cream-300'
            }`}
          >
            {/* Arabic + play + ayah marker */}
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => toggleAyah(ayah.number)}
                aria-label={
                  isPlaying ? `Stop āyah ${ayah.number}` : `Play āyah ${ayah.number}`
                }
                className="mt-1 flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#F1F5F1] text-[#3B523C] transition-colors hover:bg-[#DCE7DC]"
              >
                {isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <p
                className="flex-1 text-right font-arabic text-[28px] leading-[2.1] text-terracotta-900"
                dir="rtl"
                lang="ar"
              >
                {ayah.arabic}{' '}
                <span className="relative inline-flex items-center justify-center align-middle">
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 40 40"
                    className="text-sage-400"
                    aria-hidden="true"
                  >
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      d="M20 3l4.5 3.2 5.5-.4 1.6 5.3 4.4 3.3-2 5.1 2 5.1-4.4 3.3-1.6 5.3-5.5-.4L20 37l-4.5-3.2-5.5.4-1.6-5.3L4 25.6l2-5.1-2-5.1 4.4-3.3 1.6-5.3 5.5.4z"
                    />
                  </svg>
                  <span className="absolute font-sans text-[11px] font-semibold text-sage-600">
                    {toArabicDigits(ayah.number)}
                  </span>
                </span>
              </p>
            </div>

            {/* Transliteration */}
            <p className="mt-3 text-[13px] italic text-[#8a7163]">{ayah.transliteration}</p>

            {/* Translation */}
            <p className="mt-2 text-[14px] leading-relaxed text-terracotta-900">
              {ayah.translation}
            </p>
          </article>
        )
      })}

      <p className="pt-1 text-center text-[11px] text-[#8a7163]">
        Translation: Sahih International
      </p>
    </div>
  )
}
