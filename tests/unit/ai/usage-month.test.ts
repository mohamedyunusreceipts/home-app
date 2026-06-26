import { describe, it, expect } from 'vitest'
import { currentMonth, DEFAULT_MONTHLY_CAP } from '@/lib/ai/usage'

describe('currentMonth (Africa/Johannesburg)', () => {
  it('formats as YYYY-MM', () => {
    expect(currentMonth(new Date('2026-06-26T10:00:00Z'))).toBe('2026-06')
  })

  it('uses SAST (UTC+2) so late-UTC times do not roll back a month', () => {
    // 2026-06-30 23:30 UTC is 2026-07-01 01:30 SAST → month is July.
    expect(currentMonth(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07')
  })

  it('handles the year boundary in SAST', () => {
    // 2025-12-31 23:00 UTC is 2026-01-01 01:00 SAST.
    expect(currentMonth(new Date('2025-12-31T23:00:00Z'))).toBe('2026-01')
  })

  it('exposes the default cap', () => {
    expect(DEFAULT_MONTHLY_CAP).toBe(100)
  })
})
