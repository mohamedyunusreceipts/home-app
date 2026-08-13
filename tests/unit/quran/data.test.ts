import { describe, it, expect } from 'vitest'
import { SURAHS, getSurah, audioUrl } from '@/lib/quran/surahs'

describe("Qur'an dataset", () => {
  it('contains all 114 sūrahs with 6,236 āyāt total', () => {
    expect(SURAHS).toHaveLength(114)
    const total = SURAHS.reduce((n, s) => n + s.ayahs.length, 0)
    expect(total).toBe(6236)
  })

  it('Al-Fātiḥah has 7 āyāt and bismillah=false', () => {
    const fatiha = getSurah(1)
    expect(fatiha).toBeDefined()
    expect(fatiha!.ayahs).toHaveLength(7)
    expect(fatiha!.bismillah).toBe(false)
  })

  it('Al-Baqarah has 286 āyāt; At-Tawbah has 129 āyāt and no bismillah', () => {
    expect(getSurah(2)!.ayahs).toHaveLength(286)
    const tawbah = getSurah(9)!
    expect(tawbah.ayahs).toHaveLength(129)
    expect(tawbah.bismillah).toBe(false)
  })

  it('An-Nās has 6 āyāt and bismillah=true', () => {
    const nas = getSurah(114)
    expect(nas).toBeDefined()
    expect(nas!.ayahs).toHaveLength(6)
    expect(nas!.bismillah).toBe(true)
  })

  it('audioUrl zero-pads surah and ayah (An-Nās 114:1 → 114001.mp3)', () => {
    expect(audioUrl(114, 1, 'Alafasy_128kbps')).toBe(
      'https://everyayah.com/data/Alafasy_128kbps/114001.mp3',
    )
    expect(audioUrl(114, 1, 'Alafasy_128kbps').endsWith('/114001.mp3')).toBe(true)
  })

  it('audioUrl defaults to Alafasy and pads single digits (Al-Fātiḥah 1:1)', () => {
    expect(audioUrl(1, 1)).toBe(
      'https://everyayah.com/data/Alafasy_128kbps/001001.mp3',
    )
  })

  it('no āyah has empty Arabic or translation', () => {
    for (const surah of SURAHS) {
      for (const ayah of surah.ayahs) {
        expect(ayah.arabic.trim().length).toBeGreaterThan(0)
        expect(ayah.translation.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
