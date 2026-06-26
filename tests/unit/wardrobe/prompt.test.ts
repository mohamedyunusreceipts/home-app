import { describe, it, expect } from 'vitest'
import { buildPrompt, isPromptKind, wardrobeOutfit } from '@/lib/ai/prompts'

describe('wardrobe_outfit prompt kind', () => {
  it('is registered in the prompt registry', () => {
    expect(isPromptKind('wardrobe_outfit')).toBe(true)
  })

  it('returns a { system, messages } shape for empty context', () => {
    const built = wardrobeOutfit({})
    expect(typeof built.system).toBe('string')
    expect(built.system.length).toBeGreaterThan(0)
    expect(built.messages[0]!.role).toBe('user')
  })

  it('includes the occasion and the provided items in the user message', () => {
    const built = buildPrompt('wardrobe_outfit', {
      occasion: 'a wedding',
      season: 'summer',
      items: ['Navy linen shirt (top, summer)', 'Tan chinos (bottom)'],
    })
    const content = String(built.messages[0]!.content)
    expect(content).toContain('a wedding')
    expect(content).toContain('summer')
    expect(content).toContain('Navy linen shirt')
    expect(content).toContain('Tan chinos')
  })

  it('falls back gracefully when no occasion or items are given', () => {
    const built = wardrobeOutfit({})
    const content = String(built.messages[0]!.content)
    expect(content).toContain('everyday wear')
    expect(content.toLowerCase()).toContain('no specific items')
  })
})
