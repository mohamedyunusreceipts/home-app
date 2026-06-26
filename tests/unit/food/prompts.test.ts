import { describe, it, expect } from 'vitest'
import { isPromptKind, buildPrompt, leftoverIdeas, budgetMeals } from '@/lib/ai/prompts'

describe('food prompt kinds', () => {
  it('registers leftover_ideas and budget_meals', () => {
    expect(isPromptKind('leftover_ideas')).toBe(true)
    expect(isPromptKind('budget_meals')).toBe(true)
    // recipe_ideas was pre-seeded; confirm it is still recognised.
    expect(isPromptKind('recipe_ideas')).toBe(true)
  })

  it('buildPrompt dispatches the food kinds to a { system, messages } shape', () => {
    for (const kind of ['leftover_ideas', 'budget_meals'] as const) {
      const built = buildPrompt(kind, {})
      expect(typeof built.system).toBe('string')
      expect(built.system.length).toBeGreaterThan(0)
      expect(built.messages[0]!.role).toBe('user')
    }
  })

  it('leftoverIdeas weaves leftovers and pantry into the prompt', () => {
    const built = leftoverIdeas({ leftovers: ['roast chicken', 'rice'], pantry: ['eggs'] })
    const content = String(built.messages[0]!.content)
    expect(content).toContain('roast chicken, rice')
    expect(content).toContain('eggs')
  })

  it('leftoverIdeas falls back gracefully with no input', () => {
    const built = leftoverIdeas({})
    expect(String(built.messages[0]!.content)).toMatch(/did not list/i)
  })

  it('budgetMeals weaves budget, servings and pantry into the prompt', () => {
    const built = budgetMeals({ budget: 'R800', servings: 2, pantry: ['rice', 'beans'] })
    const content = String(built.messages[0]!.content)
    expect(content).toContain('R800')
    expect(content).toContain('2 servings')
    expect(content).toContain('rice, beans')
  })

  it('budgetMeals falls back gracefully with no input', () => {
    const built = budgetMeals({})
    expect(String(built.messages[0]!.content)).toMatch(/tight budget/i)
  })
})
