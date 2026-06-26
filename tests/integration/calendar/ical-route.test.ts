import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import { GET } from '@/app/api/ical/[token]/route'
import type { NextRequest } from 'next/server'

/**
 * End-to-end test of the .ics route: it resolves the household by token (service
 * role), queries v_calendar_all, and returns an iCalendar document. Unknown
 * tokens 404.
 */
describe('GET /api/ical/[token]', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function makeHousehold(name: string) {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)
    const { data: householdId, error } = await client.rpc('create_household', {
      p_name: name,
    })
    if (error) throw new Error(`create_household failed: ${error.message}`)
    return { user, client, householdId: householdId as string }
  }

  const ctx = (token: string) => ({ params: Promise.resolve({ token }) })
  const req = {} as NextRequest

  it('404s an unknown token', async () => {
    const res = await GET(req, ctx('this-token-does-not-exist-0000000000'))
    expect(res.status).toBe(404)
  })

  it('404s an obviously too-short token without touching the DB', async () => {
    const res = await GET(req, ctx('short'))
    expect(res.status).toBe(404)
  })

  it('returns a text/calendar feed containing the household events', async () => {
    const a = await makeHousehold('A')

    await a.client.from('calendar_events').insert({
      household_id: a.householdId,
      title: 'Anniversary',
      start: '2026-07-01T18:00:00.000Z',
      end: '2026-07-01T20:00:00.000Z',
      all_day: false,
    })
    await a.client.from('bills').insert({
      household_id: a.householdId,
      name: 'Rent',
      amount: 12000,
      next_due: '2026-07-05',
    })

    const { data: token } = await a.client.rpc('rotate_ical_token')

    const res = await GET(req, ctx(token as string))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')

    const body = await res.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('SUMMARY:Anniversary')
    expect(body).toContain('SUMMARY:Rent due')
    expect(body).toContain('CATEGORIES:Bills')
    expect(body).toContain('CATEGORIES:Manual')
  })

  it("a token only exposes its own household's events", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    await a.client.from('calendar_events').insert({
      household_id: a.householdId,
      title: 'A-secret-event',
      start: '2026-07-01T18:00:00.000Z',
      all_day: false,
    })
    await b.client.from('calendar_events').insert({
      household_id: b.householdId,
      title: 'B-secret-event',
      start: '2026-07-02T18:00:00.000Z',
      all_day: false,
    })

    const { data: tokenB } = await b.client.rpc('rotate_ical_token')
    const res = await GET(req, ctx(tokenB as string))
    const body = await res.text()

    expect(body).toContain('SUMMARY:B-secret-event')
    expect(body).not.toContain('A-secret-event')
  })
})
