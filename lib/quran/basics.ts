// Qur'an learning-basics datasets for ladder levels 1-3 (Phase Q2).
//
// Level 1 — the 28 Arabic letters (Ḥurūf).
// Level 2 — vowels & sounds (Ḥarakāt).
// Level 3 — joining letters into words (Waṣl).
//
// Content is static and hand-verified. All Arabic is rendered with dir="rtl"
// lang="ar" and the Amiri (font-arabic) face in the UI. There is no reliable
// free per-letter/per-harakah audio source, so these levels are visual +
// transliteration only (see notes in the UI). Tajwīd example audio (level 4)
// uses real ayah audio via audioUrl — see ./tajweed.ts.

/** Zero-width joiner (U+200D) — forces Amiri to shape a letter's joined form. */
export const ZWJ = '‍'

// ── Level 1 · The 28 letters ────────────────────────────────────────────────

export interface Letter {
  /** The isolated Arabic letter character. */
  letter: string
  /** Its name, e.g. "alif", "bā". */
  name: string
  /** Transliteration of the letter's sound. */
  translit: string
}

/**
 * The 28 letters of the Arabic alphabet in the traditional (hijāʾī) order,
 * exactly as specified for the module.
 */
export const LETTERS: readonly Letter[] = [
  { letter: 'ا', name: 'alif', translit: 'a' },
  { letter: 'ب', name: 'bā', translit: 'b' },
  { letter: 'ت', name: 'tā', translit: 't' },
  { letter: 'ث', name: 'thā', translit: 'th' },
  { letter: 'ج', name: 'jīm', translit: 'j' },
  { letter: 'ح', name: 'ḥā', translit: 'ḥ' },
  { letter: 'خ', name: 'khā', translit: 'kh' },
  { letter: 'د', name: 'dāl', translit: 'd' },
  { letter: 'ذ', name: 'dhāl', translit: 'dh' },
  { letter: 'ر', name: 'rā', translit: 'r' },
  { letter: 'ز', name: 'zāy', translit: 'z' },
  { letter: 'س', name: 'sīn', translit: 's' },
  { letter: 'ش', name: 'shīn', translit: 'sh' },
  { letter: 'ص', name: 'ṣād', translit: 'ṣ' },
  { letter: 'ض', name: 'ḍād', translit: 'ḍ' },
  { letter: 'ط', name: 'ṭā', translit: 'ṭ' },
  { letter: 'ظ', name: 'ẓā', translit: 'ẓ' },
  { letter: 'ع', name: 'ʿayn', translit: 'ʿ' },
  { letter: 'غ', name: 'ghayn', translit: 'gh' },
  { letter: 'ف', name: 'fā', translit: 'f' },
  { letter: 'ق', name: 'qāf', translit: 'q' },
  { letter: 'ك', name: 'kāf', translit: 'k' },
  { letter: 'ل', name: 'lām', translit: 'l' },
  { letter: 'م', name: 'mīm', translit: 'm' },
  { letter: 'ن', name: 'nūn', translit: 'n' },
  { letter: 'ه', name: 'hā', translit: 'h' },
  { letter: 'و', name: 'wāw', translit: 'w' },
  { letter: 'ي', name: 'yā', translit: 'y' },
]

export interface LetterForms {
  /** Standalone form. */
  isolated: string
  /** Beginning of a word (joins to the following letter). */
  initial: string
  /** Middle of a word (joins on both sides). */
  medial: string
  /** End of a word (joins to the preceding letter). */
  final: string
}

/**
 * Compose the four contextual forms of a letter by surrounding it with the
 * zero-width joiner. The Amiri font then shapes each form correctly. Naturally
 * non-joining letters (ا د ذ ر ز و) simply won't connect on their left side,
 * which is the correct behaviour — no special-casing needed.
 */
export function letterForms(letter: string): LetterForms {
  return {
    isolated: letter,
    initial: `${letter}${ZWJ}`,
    medial: `${ZWJ}${letter}${ZWJ}`,
    final: `${ZWJ}${letter}`,
  }
}

// ── Level 2 · Vowels & sounds ───────────────────────────────────────────────

export interface Harakah {
  /** Stable id. */
  id: string
  /** English name. */
  name: string
  /** Arabic name. */
  arabicName: string
  /** The sample letter + mark rendered in Arabic (e.g. بَ). */
  sample: string
  /** Transliteration of the sample (e.g. "ba"). */
  translit: string
  /** One-line explanation of the mark. */
  explanation: string
}

// Sample letter is bā (ب) throughout so learners compare the same base sound.
export const HARAKAT: readonly Harakah[] = [
  {
    id: 'fatha',
    name: 'Fatḥa',
    arabicName: 'فَتْحَة',
    sample: 'بَ',
    translit: 'ba',
    explanation: 'A small stroke above the letter giving a short "a" sound.',
  },
  {
    id: 'kasra',
    name: 'Kasra',
    arabicName: 'كَسْرَة',
    sample: 'بِ',
    translit: 'bi',
    explanation: 'A small stroke below the letter giving a short "i" sound.',
  },
  {
    id: 'damma',
    name: 'Ḍamma',
    arabicName: 'ضَمَّة',
    sample: 'بُ',
    translit: 'bu',
    explanation: 'A small wāw-shape above the letter giving a short "u" sound.',
  },
  {
    id: 'sukun',
    name: 'Sukūn',
    arabicName: 'سُكُون',
    sample: 'بْ',
    translit: 'b',
    explanation: 'A small circle marking a consonant with no vowel after it.',
  },
  {
    id: 'tanwin-fath',
    name: 'Tanwīn (fatḥ)',
    arabicName: 'تَنْوِين',
    sample: 'بًا',
    translit: 'ban',
    explanation: 'Double fatḥa adds a final "n" sound — an "-an" ending.',
  },
  {
    id: 'tanwin-kasr',
    name: 'Tanwīn (kasr)',
    arabicName: 'تَنْوِين',
    sample: 'بٍ',
    translit: 'bin',
    explanation: 'Double kasra adds a final "n" sound — an "-in" ending.',
  },
  {
    id: 'tanwin-damm',
    name: 'Tanwīn (ḍamm)',
    arabicName: 'تَنْوِين',
    sample: 'بٌ',
    translit: 'bun',
    explanation: 'Double ḍamma adds a final "n" sound — an "-un" ending.',
  },
  {
    id: 'madd-alif',
    name: 'Madd (ā)',
    arabicName: 'مَدّ',
    sample: 'بَا',
    translit: 'bā',
    explanation: 'Fatḥa followed by alif stretches the "a" into a long "ā".',
  },
  {
    id: 'madd-ya',
    name: 'Madd (ī)',
    arabicName: 'مَدّ',
    sample: 'بِي',
    translit: 'bī',
    explanation: 'Kasra followed by yā stretches the "i" into a long "ī".',
  },
  {
    id: 'madd-waw',
    name: 'Madd (ū)',
    arabicName: 'مَدّ',
    sample: 'بُو',
    translit: 'bū',
    explanation: 'Ḍamma followed by wāw stretches the "u" into a long "ū".',
  },
]

// ── Level 3 · Joining words ─────────────────────────────────────────────────

export interface Word {
  /** The full joined word in Arabic. */
  word: string
  /** The individual letters that make up the word, in reading order (R→L). */
  letters: string[]
  /** Transliteration of the whole word. */
  translit: string
  /** English meaning. */
  meaning: string
}

/**
 * Short, simple words that show how letters join. Kept neutral and common; a
 * few are frequent Qur'anic words (kept short and correct).
 */
export const WORDS: readonly Word[] = [
  { word: 'أَب', letters: ['أ', 'ب'], translit: 'ab', meaning: 'father' },
  { word: 'أُمّ', letters: ['أ', 'م'], translit: 'umm', meaning: 'mother' },
  { word: 'دَار', letters: ['د', 'ا', 'ر'], translit: 'dār', meaning: 'house' },
  { word: 'بَاب', letters: ['ب', 'ا', 'ب'], translit: 'bāb', meaning: 'door' },
  { word: 'قَلَم', letters: ['ق', 'ل', 'م'], translit: 'qalam', meaning: 'pen' },
  { word: 'كِتَاب', letters: ['ك', 'ت', 'ا', 'ب'], translit: 'kitāb', meaning: 'book' },
  { word: 'شَمْس', letters: ['ش', 'م', 'س'], translit: 'shams', meaning: 'sun' },
  { word: 'قَمَر', letters: ['ق', 'م', 'ر'], translit: 'qamar', meaning: 'moon' },
  { word: 'مَاء', letters: ['م', 'ا', 'ء'], translit: 'māʾ', meaning: 'water' },
  { word: 'نُور', letters: ['ن', 'و', 'ر'], translit: 'nūr', meaning: 'light' },
  { word: 'سَلَام', letters: ['س', 'ل', 'ا', 'م'], translit: 'salām', meaning: 'peace' },
  { word: 'رَبّ', letters: ['ر', 'ب'], translit: 'rabb', meaning: 'Lord' },
]
