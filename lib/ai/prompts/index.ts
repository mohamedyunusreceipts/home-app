import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

/**
 * AI Suggest prompt registry (spec §8.1).
 *
 * One endpoint (`POST /api/ai/suggest`) dispatches to a per-`kind` prompt
 * builder. Each builder is a PURE function `(context) => BuiltPrompt`, making it
 * trivially unit-testable and keeping prompt text out of the route handler.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HOW A MODULE ADDS A NEW `kind`
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Write a pure builder `(context: unknown) => BuiltPrompt`. Read what you
 *    need off `context`, defensively (the client supplies it). Return a
 *    `system` string and a `messages` array (Anthropic `MessageParam[]`).
 * 2. Register it in `PROMPT_BUILDERS` below under a new string key.
 * 3. Add a unit test asserting the built shape (see tests/unit/ai).
 *
 * That's the whole contract — no route changes are needed. The route validates
 * the incoming `kind` against this registry and 400s unknown kinds.
 */

export interface BuiltPrompt {
  system: string
  messages: MessageParam[]
}

export type PromptBuilder = (context: unknown) => BuiltPrompt

/** Narrow an unknown context to a plain record for safe field access. */
function asRecord(context: unknown): Record<string, unknown> {
  return context && typeof context === 'object'
    ? (context as Record<string, unknown>)
    : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * Example kind: recipe ideas from a list of ingredients on hand.
 * context: { ingredients?: string[]; notes?: string }
 */
export const recipeIdeas: PromptBuilder = (context) => {
  const c = asRecord(context)
  const ingredients = asStringArray(c.ingredients)
  const notes = typeof c.notes === 'string' ? c.notes : ''

  const ingredientLine =
    ingredients.length > 0
      ? `We have these ingredients on hand: ${ingredients.join(', ')}.`
      : 'We did not list specific ingredients; suggest flexible, pantry-friendly ideas.'

  return {
    system:
      'You suggest practical home-cooking ideas for a busy couple. ' +
      'Reply with 3 concise recipe ideas as a short list. For each give a name ' +
      'and a one-line description. No preamble.',
    messages: [
      {
        role: 'user',
        content: [ingredientLine, notes].filter(Boolean).join('\n'),
      },
    ],
  }
}

/**
 * Food kind: leftover ideas — repurpose what's about to expire (spec §9.2).
 * context: { leftovers?: string[]; pantry?: string[]; notes?: string }
 */
export const leftoverIdeas: PromptBuilder = (context) => {
  const c = asRecord(context)
  const leftovers = asStringArray(c.leftovers)
  const pantry = asStringArray(c.pantry)
  const notes = typeof c.notes === 'string' ? c.notes : ''

  const leftoverLine =
    leftovers.length > 0
      ? `Leftovers / things to use up soon: ${leftovers.join(', ')}.`
      : 'We did not list specific leftovers; suggest flexible ways to use up odds and ends.'
  const pantryLine =
    pantry.length > 0 ? `Also on hand in the pantry: ${pantry.join(', ')}.` : ''

  return {
    system:
      'You help a busy couple turn leftovers and soon-to-expire food into easy ' +
      'meals so nothing goes to waste. Reply with 3 concise ideas as a short ' +
      'list. For each give a name and a one-line method. No preamble.',
    messages: [
      {
        role: 'user',
        content: [leftoverLine, pantryLine, notes].filter(Boolean).join('\n'),
      },
    ],
  }
}

/**
 * Food kind: budget meals for the week (spec §9.2).
 * context: { budget?: string | number; servings?: number; pantry?: string[]; notes?: string }
 */
export const budgetMeals: PromptBuilder = (context) => {
  const c = asRecord(context)
  const budget =
    typeof c.budget === 'string' || typeof c.budget === 'number'
      ? String(c.budget)
      : 'a tight budget'
  const servings = typeof c.servings === 'number' ? c.servings : undefined
  const pantry = asStringArray(c.pantry)
  const notes = typeof c.notes === 'string' ? c.notes : ''

  const servingsLine = servings ? ` for ${servings} servings each` : ''
  const pantryLine =
    pantry.length > 0 ? ` Use what we already have where possible: ${pantry.join(', ')}.` : ''

  return {
    system:
      'You plan affordable weeknight dinners for a couple in South Africa, ' +
      'mindful of cost. Reply with up to 5 budget-friendly meal ideas as a ' +
      'short list, each with a name and a one-line note on why it is cheap. ' +
      'No preamble.',
    messages: [
      {
        role: 'user',
        content:
          `Suggest budget meals for the week on ${budget}${servingsLine}.` +
          pantryLine +
          (notes ? `\n${notes}` : ''),
      },
    ],
  }
}

/**
 * Example kind: gift ideas for a person/occasion within a budget.
 * context: { recipient?: string; occasion?: string; budget?: string | number; interests?: string[] }
 */
export const giftIdeas: PromptBuilder = (context) => {
  const c = asRecord(context)
  const recipient = typeof c.recipient === 'string' ? c.recipient : 'someone'
  const occasion = typeof c.occasion === 'string' ? c.occasion : 'a special occasion'
  const budget =
    typeof c.budget === 'string' || typeof c.budget === 'number'
      ? String(c.budget)
      : 'a sensible budget'
  const interests = asStringArray(c.interests)

  const interestLine =
    interests.length > 0 ? ` Their interests: ${interests.join(', ')}.` : ''

  return {
    system:
      'You suggest thoughtful gift ideas. Reply with 3 distinct ideas as a ' +
      'short list, each with a one-line reason it fits. No preamble.',
    messages: [
      {
        role: 'user',
        content:
          `Suggest gifts for ${recipient} for ${occasion}, budget ${budget}.` +
          interestLine,
      },
    ],
  }
}

/**
 * Wardrobe kind: suggest an outfit for an occasion (spec §9.6).
 * context: { occasion?: string; season?: string; weather?: string;
 *            items?: string[]; notes?: string }
 * `items` is a pre-formatted list of the owner's available garments
 * (e.g. "Navy linen shirt (top, summer)"), built client-side from the wardrobe.
 */
export const wardrobeOutfit: PromptBuilder = (context) => {
  const c = asRecord(context)
  const occasion = typeof c.occasion === 'string' && c.occasion.trim() ? c.occasion : 'everyday wear'
  const season = typeof c.season === 'string' ? c.season : ''
  const weather = typeof c.weather === 'string' ? c.weather : ''
  const items = asStringArray(c.items)
  const notes = typeof c.notes === 'string' ? c.notes : ''

  const wardrobeLine =
    items.length > 0
      ? `Available items in the wardrobe:\n${items.map((i) => `- ${i}`).join('\n')}`
      : 'No specific items were listed; suggest a sensible outfit composition by category.'
  const contextLine = [
    season ? `Season: ${season}.` : '',
    weather ? `Weather: ${weather}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    system:
      'You are a personal stylist helping someone put together an outfit from ' +
      'the clothes they already own. Pick ONE coherent outfit — name the pieces ' +
      '(top, bottom or dress, shoes, and an optional layer or accessory) using ' +
      'only items from the provided list where one is given. Keep it to a short ' +
      'list plus one line on why it works. No preamble.',
    messages: [
      {
        role: 'user',
        content: [
          `Suggest an outfit for ${occasion}.`,
          contextLine,
          wardrobeLine,
          notes,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  }
}

/**
 * Vision kind STUB: receipt OCR (spec §8.1 — "Haiku with vision for receipt OCR").
 *
 * Wires the multimodal message shape (a base64 image block + an instruction)
 * so a module can build on it, but it is not exercised end-to-end in v1.
 * context: { imageBase64?: string; mediaType?: string }
 */
export const receiptOcr: PromptBuilder = (context) => {
  const c = asRecord(context)
  const imageBase64 = typeof c.imageBase64 === 'string' ? c.imageBase64 : ''
  const mediaType =
    typeof c.mediaType === 'string' ? c.mediaType : 'image/jpeg'

  return {
    system:
      'You extract structured data from a photographed receipt. Return JSON ' +
      'with: merchant, date (YYYY-MM-DD), total (number), and line_items ' +
      '(array of { description, amount }). Use null for fields you cannot read.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              // Cast keeps the stub honest without over-constraining media types.
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          { type: 'text', text: 'Extract the receipt data as specified.' },
        ],
      },
    ],
  }
}

/**
 * The registry. Module authors add entries here (see header doc).
 */
export const PROMPT_BUILDERS = {
  recipe_ideas: recipeIdeas,
  leftover_ideas: leftoverIdeas,
  budget_meals: budgetMeals,
  gift_ideas: giftIdeas,
  wardrobe_outfit: wardrobeOutfit,
  receipt_ocr: receiptOcr,
} satisfies Record<string, PromptBuilder>

export type PromptKind = keyof typeof PROMPT_BUILDERS

export function isPromptKind(kind: unknown): kind is PromptKind {
  return typeof kind === 'string' && kind in PROMPT_BUILDERS
}

export function buildPrompt(kind: PromptKind, context: unknown): BuiltPrompt {
  return PROMPT_BUILDERS[kind](context)
}
