import { describe, it, expect } from 'vitest'
import { parseReceiptResult } from '@/components/money/receipt'

describe('parseReceiptResult', () => {
  it('parses a clean JSON response', () => {
    const result = JSON.stringify({
      merchant: 'Woolworths',
      date: '2026-06-20',
      total: 432.5,
      line_items: [{ description: 'Milk', amount: 25 }],
    })
    const p = parseReceiptResult(result)
    expect(p.merchant).toBe('Woolworths')
    expect(p.amount).toBe(432.5)
    expect(p.date).toBe('2026-06-20')
    expect(p.suggestedCategory).toBe('Groceries')
  })

  it('extracts JSON wrapped in prose / code fences', () => {
    const result =
      'Here is the receipt data:\n```json\n{"merchant":"Engen","date":"2026-06-01","total":"R 850,00"}\n```\nThanks!'
    const p = parseReceiptResult(result)
    expect(p.merchant).toBe('Engen')
    expect(p.amount).toBe(850)
    expect(p.suggestedCategory).toBe('Transport')
  })

  it('handles a string total with currency symbols and ZA decimal comma', () => {
    const p = parseReceiptResult('{"merchant":"Cafe","total":"R1 234,56"}')
    expect(p.amount).toBe(1234.56)
    expect(p.suggestedCategory).toBe('Dining')
  })

  it('returns all-null on unparseable text (graceful manual-entry fallback)', () => {
    const p = parseReceiptResult('sorry, I could not read the receipt')
    expect(p).toEqual({
      amount: null,
      merchant: null,
      date: null,
      suggestedCategory: null,
    })
  })

  it('leaves unknown fields null but keeps what it can read', () => {
    const p = parseReceiptResult('{"merchant":"Unknown Shop","total":null}')
    expect(p.merchant).toBe('Unknown Shop')
    expect(p.amount).toBeNull()
    expect(p.date).toBeNull()
  })

  it('honours an explicit valid suggested_category', () => {
    const p = parseReceiptResult(
      '{"merchant":"Generic","total":10,"suggested_category":"Utilities"}',
    )
    expect(p.suggestedCategory).toBe('Utilities')
  })
})
