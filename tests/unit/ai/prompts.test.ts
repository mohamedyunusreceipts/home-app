import { describe, it, expect } from 'vitest'
import {
  buildPrompt,
  isPromptKind,
  PROMPT_BUILDERS,
  recipeIdeas,
  giftIdeas,
  receiptOcr,
} from '@/lib/ai/prompts'

describe('prompt registry', () => {
  it('recognises every seeded kind and rejects unknowns', () => {
    expect(isPromptKind('recipe_ideas')).toBe(true)
    expect(isPromptKind('gift_ideas')).toBe(true)
    expect(isPromptKind('receipt_ocr')).toBe(true)
    expect(isPromptKind('nope')).toBe(false)
    expect(isPromptKind(undefined)).toBe(false)
    expect(isPromptKind(42)).toBe(false)
  })

  it('every registered builder returns a { system, messages } shape', () => {
    for (const builder of Object.values(PROMPT_BUILDERS)) {
      const built = builder({})
      expect(typeof built.system).toBe('string')
      expect(built.system.length).toBeGreaterThan(0)
      expect(Array.isArray(built.messages)).toBe(true)
      expect(built.messages.length).toBeGreaterThan(0)
      expect(built.messages[0]!.role).toBe('user')
    }
  })
})

describe('recipeIdeas builder', () => {
  it('includes provided ingredients in the user message', () => {
    const built = recipeIdeas({ ingredients: ['eggs', 'spinach'], notes: 'quick' })
    const content = built.messages[0]!.content
    expect(String(content)).toContain('eggs, spinach')
    expect(String(content)).toContain('quick')
  })

  it('falls back gracefully when no ingredients are given', () => {
    const built = recipeIdeas({})
    expect(String(built.messages[0]!.content)).toMatch(/did not list/i)
  })
})

describe('giftIdeas builder', () => {
  it('weaves recipient, occasion, budget and interests into the prompt', () => {
    const built = giftIdeas({
      recipient: 'my partner',
      occasion: 'anniversary',
      budget: 500,
      interests: ['cycling', 'coffee'],
    })
    const content = String(built.messages[0]!.content)
    expect(content).toContain('my partner')
    expect(content).toContain('anniversary')
    expect(content).toContain('500')
    expect(content).toContain('cycling, coffee')
  })

  it('uses sensible defaults for an empty context', () => {
    const built = giftIdeas({})
    const content = String(built.messages[0]!.content)
    expect(content).toContain('someone')
    expect(content).toContain('special occasion')
  })
})

describe('receiptOcr vision stub', () => {
  it('produces a multimodal message with a base64 image block', () => {
    const built = receiptOcr({ imageBase64: 'AAAA', mediaType: 'image/png' })
    const content = built.messages[0]!.content
    expect(Array.isArray(content)).toBe(true)
    const blocks = content as Array<{ type: string; source?: { data?: string; media_type?: string } }>
    const image = blocks.find((b) => b.type === 'image')
    expect(image).toBeDefined()
    expect(image!.source!.data).toBe('AAAA')
    expect(image!.source!.media_type).toBe('image/png')
    expect(blocks.some((b) => b.type === 'text')).toBe(true)
  })
})

describe('buildPrompt dispatch', () => {
  it('dispatches to the builder for the given kind', () => {
    const built = buildPrompt('gift_ideas', { recipient: 'Sam' })
    expect(String(built.messages[0]!.content)).toContain('Sam')
  })
})
