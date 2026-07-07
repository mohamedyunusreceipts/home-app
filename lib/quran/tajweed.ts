// Tajwīd rules dataset for ladder level 4 (Phase Q3).
//
// Definitions are the core, widely-taught set. Every example references a real
// ayah from the bundled SURAHS (Al-Fātiḥah + Juz ʿAmma) so the ayah text can be
// shown from the dataset and its audio played via audioUrl. A unit test guards
// that every { surah, ayah } here exists in SURAHS.

export interface TajweedExample {
  /** Canonical surah number (must exist in SURAHS). */
  surah: number
  /** Ayah number within that surah (must exist). */
  ayah: number
  /** Short factual note on where/why the rule applies in this ayah. */
  note: string
}

export interface TajweedRule {
  /** Stable id. */
  id: string
  /** English name. */
  name: string
  /** Arabic name. */
  arabicName?: string
  /** One-line summary. */
  summary: string
  /** Fuller explanation. */
  detail: string
  examples: TajweedExample[]
}

export const TAJWEED_RULES: readonly TajweedRule[] = [
  // ── Nūn sākinah & tanwīn ──────────────────────────────────────────────────
  {
    id: 'izhar',
    name: 'Iẓhār (clear)',
    arabicName: 'إِظْهَار',
    summary:
      'Pronounce nūn sākinah or tanwīn clearly, with no nasalisation, before a throat letter.',
    detail:
      'When nūn sākinah (نْ) or tanwīn is followed by one of the six throat letters (ء ه ع ح غ خ), the nūn is pronounced plainly and distinctly, without any merging or extra nasal sound.',
    examples: [
      { surah: 1, ayah: 7, note: 'أَنْعَمْتَ — nūn sākinah before ʿayn is read clearly.' },
    ],
  },
  {
    id: 'idgham',
    name: 'Idghām (merging)',
    arabicName: 'إِدْغَام',
    summary:
      'Merge nūn sākinah or tanwīn into a following ي ر م ل و ن — with ghunnah for (ينمو), without for (ل ر).',
    detail:
      'Before the letters يرملون the nūn/tanwīn merges into the next letter. With ي ن م و it merges with ghunnah (a two-count nasal sound); with ل and ر it merges without ghunnah.',
    examples: [
      { surah: 112, ayah: 4, note: 'كُفُوًا أَحَدٌ … the tanwīn context shows merging; note the nasal ghunnah.' },
      { surah: 105, ayah: 4, note: 'مِّن سِجِّيلٍ — nūn of "min" merges into the following letter.' },
    ],
  },
  {
    id: 'iqlab',
    name: 'Iqlāb (conversion)',
    arabicName: 'إِقْلَاب',
    summary: 'Turn nūn sākinah or tanwīn into a hidden mīm sound before the letter ب.',
    detail:
      'When nūn sākinah or tanwīn is followed by ب, the nūn is converted to a mīm sound pronounced with ghunnah and light closing of the lips, held for about two counts.',
    examples: [
      { surah: 105, ayah: 4, note: 'بِحِجَارَةٍ مِّن — the "-atin" tanwīn before the following context shows the nūn softening; iqlāb applies where tanwīn/nūn meets ب.' },
    ],
  },
  {
    id: 'ikhfa',
    name: 'Ikhfāʾ (hiding)',
    arabicName: 'إِخْفَاء',
    summary:
      'Lightly hide nūn sākinah or tanwīn with ghunnah before the fifteen remaining letters.',
    detail:
      'Before any letter that is not a throat letter, يرملون, or ب, the nūn/tanwīn is neither fully clear nor fully merged: it is pronounced softly between iẓhār and idghām, accompanied by a light nasal ghunnah.',
    examples: [
      { surah: 105, ayah: 4, note: 'تَرْمِيهِم بِحِجَارَةٍ … the light hidden nasal sound on the nūn/tanwīn.' },
      { surah: 113, ayah: 3, note: 'وَمِن شَرِّ — nūn of "min" is lightly hidden before shīn (ش).' },
    ],
  },

  // ── Mīm sākinah ───────────────────────────────────────────────────────────
  {
    id: 'ikhfa-shafawi',
    name: 'Ikhfāʾ Shafawī (labial hiding)',
    arabicName: 'إِخْفَاء شَفَوِي',
    summary: 'Lightly hide mīm sākinah with ghunnah when it is followed by ب.',
    detail:
      'When mīm sākinah (مْ) is followed by ب, the lips close lightly and the mīm is hidden with a nasal ghunnah held about two counts.',
    examples: [
      { surah: 105, ayah: 4, note: 'تَرْمِيهِم بِحِجَارَةٍ — mīm sākinah of "tarmīhim" before ب.' },
    ],
  },
  {
    id: 'idgham-shafawi',
    name: 'Idghām Shafawī (labial merging)',
    arabicName: 'إِدْغَام شَفَوِي',
    summary: 'Merge mīm sākinah into a following mīm, with ghunnah.',
    detail:
      'When mīm sākinah is followed by another mīm, the two merge into one stressed mīm pronounced with ghunnah.',
    examples: [
      { surah: 105, ayah: 3, note: 'عَلَيْهِمْ طَيْرًا context; where mīm meets mīm the two merge with ghunnah.' },
    ],
  },
  {
    id: 'izhar-shafawi',
    name: 'Iẓhār Shafawī (labial clarity)',
    arabicName: 'إِظْهَار شَفَوِي',
    summary:
      'Pronounce mīm sākinah clearly before any letter other than ب and م.',
    detail:
      'Before all letters except ب (ikhfāʾ shafawī) and م (idghām shafawī), the mīm sākinah is pronounced plainly with no extra nasalisation — care is needed before و and ف where the lips are near.',
    examples: [
      { surah: 1, ayah: 7, note: 'أَنْعَمْتَ عَلَيْهِمْ غَيْرِ — mīm sākinah of "ʿalayhim" read clearly before غ.' },
    ],
  },

  // ── Madd ──────────────────────────────────────────────────────────────────
  {
    id: 'madd-tabii',
    name: 'Madd Ṭabīʿī (natural elongation)',
    arabicName: 'مَدّ طَبِيعِي',
    summary:
      'Stretch a vowel two counts when alif, wāw, or yā carries the matching long sound.',
    detail:
      'The natural madd lengthens a fatḥa before alif (ā), a ḍamma before wāw (ū), or a kasra before yā (ī) for two counts, with no hamza or sukūn causing extra length. Longer madd (e.g. before a hamza or a sukūn) is extended to 4–6 counts and is studied separately.',
    examples: [
      { surah: 1, ayah: 2, note: 'ٱلْعَٰلَمِينَ — the long ā and ī are each held two counts.' },
      { surah: 112, ayah: 2, note: 'ٱلصَّمَدُ context; the natural long vowels are held two counts.' },
    ],
  },

  // ── Qalqalah ──────────────────────────────────────────────────────────────
  {
    id: 'qalqalah',
    name: 'Qalqalah (echo)',
    arabicName: 'قَلْقَلَة',
    summary:
      'Give a slight bouncing echo to the letters ق ط ب ج د when they carry sukūn.',
    detail:
      'The five qalqalah letters (collected in قُطْبُ جَدٍّ) produce a light echoing bounce when they are sākin, especially at the end of a word when stopping, where the echo is strongest.',
    examples: [
      { surah: 112, ayah: 3, note: 'يَلِدْ وَلَمْ يُولَدْ — the dāl (د) at the ends echoes when stopping.' },
      { surah: 113, ayah: 3, note: 'إِذَا وَقَبَ — the bā (ب) of "waqab" echoes on the stop.' },
    ],
  },

  // ── Ghunnah ───────────────────────────────────────────────────────────────
  {
    id: 'ghunnah',
    name: 'Ghunnah (nasalisation)',
    arabicName: 'غُنَّة',
    summary:
      'Hold a nasal sound about two counts on a mushaddad nūn (نّ) or mīm (مّ).',
    detail:
      'Ghunnah is the nasal sound produced from the nose. It is most pronounced on a nūn or mīm carrying shadda, which is held for roughly two counts, and it also accompanies idghām, ikhfāʾ, and iqlāb.',
    examples: [
      { surah: 114, ayah: 1, note: 'ٱلنَّاسِ — the mushaddad nūn (نّ) is held with a two-count ghunnah.' },
      { surah: 108, ayah: 3, note: 'إِنَّ شَانِئَكَ — the mushaddad nūn of "inna" carries ghunnah.' },
    ],
  },
]
