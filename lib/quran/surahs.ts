// Qur'an data + helpers for the learning module (Phase Q1).
//
// The dataset in ./data/surahs.json is AUTHORITATIVE and VERIFIED (Uthmani text
// from alquran.cloud, Basmala separated). It is imported as-is and never mutated
// here. Al-Fatihah (1) + Juz 'Amma (78-114) = 38 surahs.

import surahsData from './data/surahs.json'

export interface Ayah {
  /** Ayah number within the surah (1-based). */
  number: number
  /** Uthmani Arabic text (Basmala already removed where bismillah=true). */
  arabic: string
  transliteration: string
  /** English translation (Sahih International). */
  translation: string
}

export interface Surah {
  /** Canonical surah number (1 = Al-Fatihah, 114 = An-Nas). */
  number: number
  /** Arabic name, e.g. سُورَةُ ٱلْفَاتِحَةِ */
  name: string
  englishName: string
  englishNameTranslation: string
  revelationType: 'Meccan' | 'Medinan'
  /**
   * Whether to render a standalone Basmala heading above the surah.
   * false for Al-Fatihah (its ayah 1 IS the Basmala) and At-Tawbah (which has
   * no Basmala — not in this dataset). true for every other surah here, whose
   * ayah 1 has already had the Basmala removed in the dataset.
   */
  bismillah: boolean
  ayahs: Ayah[]
}

/** All 38 surahs in canonical order, typed from the verified dataset. */
export const SURAHS: readonly Surah[] = surahsData as Surah[]

/** Look up a surah by its canonical number. Returns undefined if absent. */
export function getSurah(number: number): Surah | undefined {
  return SURAHS.find((s) => s.number === number)
}

// ── Audio (everyayah.com CDN) ──────────────────────────────────────────────

export interface Reciter {
  /** everyayah.com folder id, also used as the stored value. */
  id: string
  /** Human-readable reciter name. */
  name: string
}

/**
 * A small selection of well-known murattal reciters available on everyayah.com.
 * The default is Mishary Alafasy (Alafasy_128kbps).
 */
export const RECITERS: readonly Reciter[] = [
  { id: 'Alafasy_128kbps', name: 'Mishary Alafasy' },
  { id: 'Abdul_Basit_Murattal_128kbps', name: 'Abdul Basit (Murattal)' },
  { id: 'Husary_128kbps', name: 'Mahmoud Al-Husary' },
  { id: 'Minshawy_Murattal_128kbps', name: 'Al-Minshawy (Murattal)' },
]

/** The default reciter id used when none is chosen. */
export const DEFAULT_RECITER = 'Alafasy_128kbps'

/**
 * Build the everyayah.com MP3 URL for a single ayah.
 * Format: https://everyayah.com/data/{reciter}/{SSSAAA}.mp3
 * where SSS = zero-padded surah number and AAA = zero-padded ayah number.
 * e.g. audioUrl(114, 1, 'Alafasy_128kbps') → .../114001.mp3
 */
export function audioUrl(
  surahNumber: number,
  ayahNumber: number,
  reciter: string = DEFAULT_RECITER,
): string {
  const s = String(surahNumber).padStart(3, '0')
  const a = String(ayahNumber).padStart(3, '0')
  return `https://everyayah.com/data/${reciter}/${s}${a}.mp3`
}

// ── The 6-level learning ladder ────────────────────────────────────────────

export type LevelStatus = 'coming-soon' | 'ready'

export interface Level {
  /** 1-6 ladder position. */
  level: number
  /** Short English title, e.g. "Reading". */
  title: string
  /** Arabic / transliterated label, e.g. "Ḥurūf". */
  arabicLabel: string
  /** One-line description of what the level teaches. */
  description: string
  status: LevelStatus
  /** Route this level links to when ready, else null. */
  href: string | null
}

/**
 * The learning ladder. Levels 1-4 are built in later phases (coming-soon);
 * Level 5 (Reading) and Level 6 (Ḥifẓ) ship in Phase Q1.
 */
export const LEVELS: readonly Level[] = [
  {
    level: 1,
    title: 'Letters',
    arabicLabel: 'Ḥurūf',
    description: 'Recognise and name the Arabic letters.',
    status: 'coming-soon',
    href: null,
  },
  {
    level: 2,
    title: 'Vowels & sounds',
    arabicLabel: 'Ḥarakāt',
    description: 'Short vowels, tanwīn, and letter sounds.',
    status: 'coming-soon',
    href: null,
  },
  {
    level: 3,
    title: 'Joining words',
    arabicLabel: 'Waṣl',
    description: 'Connect letters and read whole words.',
    status: 'coming-soon',
    href: null,
  },
  {
    level: 4,
    title: 'Tajwīd',
    arabicLabel: 'Tajwīd',
    description: 'Rules of correct, beautiful recitation.',
    status: 'coming-soon',
    href: null,
  },
  {
    level: 5,
    title: 'Reading',
    arabicLabel: 'Qirāʾah',
    description: 'Read along with the text and audio.',
    status: 'ready',
    href: '/quran/read',
  },
  {
    level: 6,
    title: 'Ḥifẓ',
    arabicLabel: 'Ḥifẓ',
    description: 'Memorise and track your revision.',
    status: 'ready',
    href: '/quran/hifz',
  },
]

export type HifzStatus = 'learning' | 'memorised'
