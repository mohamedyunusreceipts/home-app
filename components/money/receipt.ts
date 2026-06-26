// Pure helper: turn the AI receipt-OCR text response into expense-form pre-fill.
//
// The /api/ai/suggest endpoint (kind: 'receipt_ocr') returns { result } where
// `result` is the model's text. The receipt_ocr prompt asks for JSON with
// { merchant, date (YYYY-MM-DD), total (number), line_items }. This parser
// tolerantly extracts that JSON (the model may wrap it in prose or a code fence)
// and maps it to the fields the expense form pre-fills:
//   { amount, merchant, date, suggested_category }
//
// Category is guessed from the merchant/line text against the seeded category
// list — purely a convenience default the user can change. Side-effect free;
// unit-tested in tests/unit/money/receipt.test.ts.

import { DEFAULT_CATEGORIES } from './categories'

export interface ReceiptPrefill {
  amount: number | null
  merchant: string | null
  date: string | null
  suggestedCategory: string | null
}

/** Pull the first JSON object out of arbitrary model text. */
function extractJsonObject(text: string): Record<string, unknown> | null {
  if (typeof text !== 'string') return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  const candidate = text.slice(start, end + 1)
  try {
    const parsed: unknown = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function asAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100) / 100
  }
  if (typeof value === 'string') {
    // Strip currency symbols, spaces, thousands separators; accept , or . as decimal.
    const cleaned = value.replace(/[^\d.,-]/g, '').replace(/\s/g, '')
    const normalised = cleaned.replace(/,(\d{2})$/, '.$1').replace(/,/g, '')
    const n = Number(normalised)
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100
  }
  return null
}

function asDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // Accept YYYY-MM-DD as-is; otherwise try to parse and re-emit.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Heuristically guess a seeded category from merchant + line-item text. */
function guessCategory(merchant: string | null, haystack: string): string | null {
  const hay = `${merchant ?? ''} ${haystack}`.toLowerCase()
  const rules: Array<[string, RegExp]> = [
    ['Groceries', /grocer|supermarket|woolworth|checkers|pick n pay|spar|food lover/],
    ['Dining', /restaurant|cafe|coffee|bar|grill|pizza|burger|kfc|nando|uber eats|mr d/],
    ['Transport', /uber|bolt|fuel|petrol|garage|engen|shell|caltex|gautrain|parking/],
    ['Utilities', /eskom|electric|water|municipal|telkom|vodacom|mtn|fibre|internet/],
    ['Entertainment', /netflix|spotify|showmax|cinema|movie|ticket|game/],
  ]
  for (const [category, re] of rules) {
    if (re.test(hay)) return category
  }
  return null
}

/**
 * Parse the AI receipt-OCR `result` text into expense-form pre-fill. Always
 * returns a ReceiptPrefill (fields null when not confidently extracted) so the
 * caller can degrade to manual entry without special-casing failures.
 */
export function parseReceiptResult(resultText: string): ReceiptPrefill {
  const obj = extractJsonObject(resultText)
  if (!obj) {
    return { amount: null, merchant: null, date: null, suggestedCategory: null }
  }

  const merchant = asText(obj.merchant)
  const amount = asAmount(obj.total ?? obj.amount)
  const date = asDate(obj.date)

  // Build a small haystack from any line-item descriptions for category guessing.
  let lineText = ''
  if (Array.isArray(obj.line_items)) {
    lineText = obj.line_items
      .map((li) =>
        li && typeof li === 'object' && 'description' in li
          ? String((li as Record<string, unknown>).description ?? '')
          : '',
      )
      .join(' ')
  }

  const explicit = asText((obj as Record<string, unknown>).suggested_category)
  const guessed = guessCategory(merchant, lineText)
  const suggestedCategory =
    explicit && DEFAULT_CATEGORIES.includes(explicit as never)
      ? explicit
      : (guessed ?? explicit ?? null)

  return { amount, merchant, date, suggestedCategory }
}
