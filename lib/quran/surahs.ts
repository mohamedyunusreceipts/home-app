// Qur'an dataset (SERVER-ONLY) + lookup helpers.
//
// The dataset in ./data/surahs.json is AUTHORITATIVE and VERIFIED (Uthmani text
// from alquran.cloud, Basmala separated). It is imported as-is and never mutated
// here. All 114 surahs (6,236 ayahs).
//
// ⚠️  Importing ANY runtime value from this module pulls the full 3.6 MB dataset
// into that bundle. Client components must import types + audio/ladder helpers
// from './meta' instead; server components pass the specific surah (or a
// lightweight metadata list) down as props.

import surahsData from './data/surahs.json'
import type { Surah } from './meta'

// Re-export the light-weight types + helpers so server code can keep importing
// everything from '@/lib/quran/surahs'.
export * from './meta'

/** All 114 surahs in canonical order, typed from the verified dataset. */
export const SURAHS: readonly Surah[] = surahsData as Surah[]

/** Look up a surah by its canonical number. Returns undefined if absent. */
export function getSurah(number: number): Surah | undefined {
  return SURAHS.find((s) => s.number === number)
}
