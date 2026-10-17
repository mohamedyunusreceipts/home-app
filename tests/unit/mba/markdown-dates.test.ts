import { describe, it, expect } from 'vitest'
import { parseMarkdown, parseInline } from '@/lib/mba/markdown'
import { dayKey, daysUntil } from '@/lib/mba/dates'

describe('parseMarkdown', () => {
  it('splits headings, paragraphs and bullet lists', () => {
    const md = [
      '## Key ideas',
      'First paragraph line one',
      'continues here.',
      '',
      '- point one',
      '- point **two**',
      '',
      '### Questions',
      '* star bullet',
    ].join('\n')
    expect(parseMarkdown(md)).toEqual([
      { type: 'h', level: 2, text: 'Key ideas' },
      { type: 'p', text: 'First paragraph line one continues here.' },
      { type: 'ul', items: ['point one', 'point **two**'] },
      { type: 'h', level: 3, text: 'Questions' },
      { type: 'ul', items: ['star bullet'] },
    ])
  })

  it('never produces raw HTML — angle brackets stay as text', () => {
    expect(parseMarkdown('<script>alert(1)</script>')).toEqual([
      { type: 'p', text: '<script>alert(1)</script>' },
    ])
  })

  it('returns [] for empty input', () => {
    expect(parseMarkdown('   \n\n')).toEqual([])
  })
})

describe('parseInline', () => {
  it('splits **bold** segments', () => {
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false },
    ])
  })
  it('leaves an unclosed marker as text', () => {
    expect(parseInline('a **b')).toEqual([{ text: 'a **b', bold: false }])
  })
})

describe('dates (Africa/Johannesburg)', () => {
  it('dayKey uses the SAST calendar day', () => {
    expect(dayKey(new Date('2026-11-08T21:59:00Z'))).toBe('2026-11-08')
    expect(dayKey(new Date('2026-11-08T22:30:00Z'))).toBe('2026-11-09')
  })

  it('daysUntil counts SAST calendar days, not 24h blocks', () => {
    const now = new Date('2026-10-17T20:00:00Z') // 22:00 SAST, Sat 17 Oct
    expect(daysUntil(new Date('2026-10-17T21:00:00Z'), now)).toBe(0) // 23:00 same day
    expect(daysUntil(new Date('2026-10-18T06:00:00Z'), now)).toBe(1) // next morning
    expect(daysUntil(new Date('2026-10-20T17:00:00Z'), now)).toBe(3)
    expect(daysUntil(new Date('2026-10-16T10:00:00Z'), now)).toBe(-1)
  })
})
