import { describe, it, expect } from 'vitest'
import {
  LETTERS,
  HARAKAT,
  WORDS,
  letterForms,
  ZWJ,
} from '@/lib/quran/basics'
import { TAJWEED_RULES } from '@/lib/quran/tajweed'
import { getSurah } from '@/lib/quran/surahs'

describe('Qur’an basics — letters', () => {
  it('LETTERS has exactly 28 entries', () => {
    expect(LETTERS).toHaveLength(28)
  })

  it('every letter has a non-empty letter, name and translit', () => {
    for (const l of LETTERS) {
      expect(l.letter.length).toBeGreaterThan(0)
      expect(l.name.trim().length).toBeGreaterThan(0)
      expect(l.translit.trim().length).toBeGreaterThan(0)
    }
  })

  it('letterForms(bā) contains the ZWJ in initial/medial/final but not isolated', () => {
    const forms = letterForms('ب')
    expect(forms.isolated).toBe('ب')
    expect(forms.isolated.includes(ZWJ)).toBe(false)
    expect(forms.initial.includes(ZWJ)).toBe(true)
    expect(forms.medial.includes(ZWJ)).toBe(true)
    expect(forms.final.includes(ZWJ)).toBe(true)
    // Medial is joined on both sides → two ZWJs; initial/final only one.
    expect(forms.medial.split(ZWJ).length - 1).toBe(2)
    expect(forms.initial.split(ZWJ).length - 1).toBe(1)
    expect(forms.final.split(ZWJ).length - 1).toBe(1)
    // The base letter is preserved in every form.
    for (const form of Object.values(forms)) {
      expect(form.includes('ب')).toBe(true)
    }
  })
})

describe('Qur’an basics — vowels & words', () => {
  it('HARAKAT is non-empty and every entry is fully populated', () => {
    expect(HARAKAT.length).toBeGreaterThan(0)
    for (const h of HARAKAT) {
      expect(h.id.length).toBeGreaterThan(0)
      expect(h.sample.length).toBeGreaterThan(0)
      expect(h.translit.length).toBeGreaterThan(0)
      expect(h.explanation.trim().length).toBeGreaterThan(0)
    }
  })

  it('WORDS is non-empty and each word lists its letters', () => {
    expect(WORDS.length).toBeGreaterThan(0)
    for (const w of WORDS) {
      expect(w.word.length).toBeGreaterThan(0)
      expect(w.letters.length).toBeGreaterThan(0)
      expect(w.translit.length).toBeGreaterThan(0)
      expect(w.meaning.length).toBeGreaterThan(0)
    }
  })
})

describe('Tajwīd rules', () => {
  it('TAJWEED_RULES is non-empty', () => {
    expect(TAJWEED_RULES.length).toBeGreaterThan(0)
  })

  it('every rule has at least one example and required fields', () => {
    for (const rule of TAJWEED_RULES) {
      expect(rule.id.length).toBeGreaterThan(0)
      expect(rule.name.trim().length).toBeGreaterThan(0)
      expect(rule.summary.trim().length).toBeGreaterThan(0)
      expect(rule.detail.trim().length).toBeGreaterThan(0)
      expect(rule.examples.length).toBeGreaterThan(0)
    }
  })

  it('every example references a surah/ayah that exists in SURAHS', () => {
    for (const rule of TAJWEED_RULES) {
      for (const ex of rule.examples) {
        const surah = getSurah(ex.surah)
        expect(surah, `rule ${rule.id}: surah ${ex.surah} missing`).toBeDefined()
        const ayah = surah!.ayahs.find((a) => a.number === ex.ayah)
        expect(
          ayah,
          `rule ${rule.id}: ayah ${ex.surah}:${ex.ayah} missing`,
        ).toBeDefined()
        expect(ex.note.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
