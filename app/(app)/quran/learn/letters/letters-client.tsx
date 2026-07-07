'use client'

import { useState } from 'react'
import { LETTERS, letterForms, type Letter } from '@/lib/quran/basics'

type Mode = 'grid' | 'flashcards'

const FORM_LABELS: { key: keyof ReturnType<typeof letterForms>; label: string }[] = [
  { key: 'isolated', label: 'Isolated' },
  { key: 'initial', label: 'Initial' },
  { key: 'medial', label: 'Medial' },
  { key: 'final', label: 'Final' },
]

function FormsRow({ letter }: { letter: string }) {
  const forms = letterForms(letter)
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 border-t border-[#F2EBDF] pt-3">
      {FORM_LABELS.map(({ key, label }) => (
        <div key={key} className="text-center">
          <p
            className="font-arabic text-[30px] leading-none text-terracotta-900"
            dir="rtl"
            lang="ar"
          >
            {forms[key]}
          </p>
          <p className="mt-1.5 text-[10px] font-medium tracking-wide text-[#8a7163] uppercase">
            {label}
          </p>
        </div>
      ))}
    </div>
  )
}

function LetterGrid() {
  const [openLetter, setOpenLetter] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {LETTERS.map((l) => {
        const open = openLetter === l.letter
        return (
          <button
            key={l.letter}
            type="button"
            onClick={() => setOpenLetter(open ? null : l.letter)}
            aria-expanded={open}
            className={`col-span-1 rounded-[16px] border bg-cream-50 p-3 text-center transition-colors ${
              open
                ? 'col-span-2 border-terracotta-300 sm:col-span-3'
                : 'border-cream-300 hover:bg-cream-100'
            }`}
          >
            <p
              className="font-arabic text-[44px] leading-none text-terracotta-900"
              dir="rtl"
              lang="ar"
            >
              {l.letter}
            </p>
            <p className="mt-2 text-[13px] font-semibold text-terracotta-900">{l.name}</p>
            <p className="text-[12px] text-[#8a7163]">
              sound: <span className="italic">{l.translit}</span>
            </p>
            {open ? <FormsRow letter={l.letter} /> : null}
          </button>
        )
      })}
    </div>
  )
}

function Flashcards() {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const card = LETTERS[index] as Letter

  function next() {
    setRevealed(false)
    setIndex((i) => (i + 1) % LETTERS.length)
  }
  function prev() {
    setRevealed(false)
    setIndex((i) => (i - 1 + LETTERS.length) % LETTERS.length)
  }

  return (
    <div>
      <div className="rounded-[20px] border border-cream-300 bg-cream-50 px-[18px] py-8 text-center">
        <p className="text-[11px] font-medium tracking-wide text-[#8a7163] uppercase">
          Card {index + 1} of {LETTERS.length}
        </p>
        <p
          className="mt-3 font-arabic text-[88px] leading-none text-terracotta-900"
          dir="rtl"
          lang="ar"
        >
          {card.letter}
        </p>
        {revealed ? (
          <div className="mt-4">
            <p className="text-[18px] font-semibold text-terracotta-900">{card.name}</p>
            <p className="text-[14px] text-[#8a7163]">
              sound: <span className="italic">{card.translit}</span>
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-4 inline-flex items-center rounded-full border border-cream-300 bg-white px-4 py-2 text-[13px] font-semibold text-sage-600 transition-colors hover:bg-cream-100"
          >
            Reveal name
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={prev}
          className="rounded-full border border-cream-300 bg-cream-50 px-4 py-2.5 text-[14px] font-semibold text-[#8a7163] transition-colors hover:bg-cream-100"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={next}
          className="rounded-full border border-cream-300 bg-cream-50 px-4 py-2.5 text-[14px] font-semibold text-terracotta-600 transition-colors hover:bg-cream-100"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export function LettersClient() {
  const [mode, setMode] = useState<Mode>('grid')

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(['grid', 'flashcards'] as const).map((m) => {
          const active = mode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={active}
              className={`rounded-[12px] border px-3 py-2.5 text-[14px] font-semibold capitalize transition-colors ${
                active
                  ? 'border-terracotta-300 bg-[#FBF2EE] text-terracotta-600'
                  : 'border-cream-300 bg-cream-50 text-[#8a7163]'
              }`}
            >
              {m === 'grid' ? 'Browse letters' : 'Flashcards'}
            </button>
          )
        })}
      </div>
      {mode === 'grid' ? <LetterGrid /> : <Flashcards />}
    </div>
  )
}
