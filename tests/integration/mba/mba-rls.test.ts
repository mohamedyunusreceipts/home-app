import { describe, it, expect, beforeEach } from 'vitest'
import {
  serviceClient,
  createTestUser,
  authedClient,
  resetDatabase,
} from '@/tests/helpers/supabase'

/**
 * RLS for the MBA module (0025_mba). Every table is PER-USER: a user can only
 * read/write their OWN rows — even their partner in the same household can't
 * see them. Matters most for mba_calendar_feeds, whose URLs embed private
 * calendar tokens.
 */
describe('RLS — MBA per-user isolation (0025_mba)', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function waitForProfile(id: string) {
    const service = serviceClient()
    for (let i = 0; i < 50; i++) {
      const { data } = await service.from('profiles').select('id').eq('id', id).maybeSingle()
      if (data) return
      await new Promise((r) => setTimeout(r, 50))
    }
    throw new Error(`profile ${id} never appeared`)
  }

  async function twoUsersSameHousehold() {
    const userA = await createTestUser()
    const clientA = await authedClient(userA.email, userA.password)
    const { error } = await clientA.rpc('create_household', { p_name: 'Shared home' })
    if (error) throw new Error(`create_household failed: ${error.message}`)

    const userB = await createTestUser()
    const clientB = await authedClient(userB.email, userB.password)
    const { data: token, error: inviteErr } = await clientA.rpc('generate_invite')
    if (inviteErr) throw new Error(`generate_invite failed: ${inviteErr.message}`)
    const { error: joinErr } = await clientB.rpc('accept_invite', { p_token: token as string })
    if (joinErr) throw new Error(`accept_invite failed: ${joinErr.message}`)

    await waitForProfile(userA.id)
    await waitForProfile(userB.id)
    return { userA, clientA, userB, clientB }
  }

  it("a partner cannot read or change your calendar feed (private token URL)", async () => {
    const { userA, clientA, clientB } = await twoUsersSameHousehold()

    const { data: feed, error } = await clientA
      .from('mba_calendar_feeds')
      .insert({ user_id: userA.id, kind: 'mail', url: 'https://outlook.example.com/cal.ics?token=secret' })
      .select('id')
      .single()
    expect(error).toBeNull()

    const { data: seen } = await clientB.from('mba_calendar_feeds').select('*')
    expect(seen).toEqual([])

    const { data: updated } = await clientB
      .from('mba_calendar_feeds')
      .update({ url: 'https://evil.example.com/x.ics' })
      .eq('id', feed!.id)
      .select('id')
    expect(updated).toEqual([])

    const { data: mine } = await clientA.from('mba_calendar_feeds').select('url')
    expect(mine).toEqual([{ url: 'https://outlook.example.com/cal.ics?token=secret' }])
  })

  it('sessions, deadlines and events are private to their owner', async () => {
    const { userA, clientA, clientB } = await twoUsersSameHousehold()

    const { data: feed } = await clientA
      .from('mba_calendar_feeds')
      .insert({ user_id: userA.id, kind: 'lms', url: 'https://lms.example.com/feed.ics' })
      .select('id')
      .single()

    expect(
      (
        await clientA.from('mba_sessions').insert({
          user_id: userA.id,
          course_code: 'PPM',
          session_key: '8',
          title: 'Talent management',
          summary: 'notes',
        })
      ).error,
    ).toBeNull()
    expect(
      (
        await clientA.from('mba_deadlines').insert({
          user_id: userA.id,
          title: 'Exam',
          kind: 'exam',
          due_at: '2026-11-21T07:00:00Z',
          source: 'manual',
          external_uid: 'x1',
        })
      ).error,
    ).toBeNull()
    expect(
      (
        await clientA.from('mba_events').insert({
          user_id: userA.id,
          feed_id: feed!.id,
          external_uid: 'e1',
          title: 'Triad meeting',
          starts_at: '2026-10-20T17:00:00Z',
        })
      ).error,
    ).toBeNull()

    for (const table of ['mba_sessions', 'mba_deadlines', 'mba_events'] as const) {
      const { data } = await clientB.from(table).select('id')
      expect(data, table).toEqual([])
      const { data: mine } = await clientA.from(table).select('id')
      expect(mine, table).toHaveLength(1)
    }
  })

  it('cannot insert rows on behalf of another user', async () => {
    const { userA, clientB } = await twoUsersSameHousehold()
    const { error } = await clientB.from('mba_deadlines').insert({
      user_id: userA.id,
      title: 'Spoofed',
      due_at: '2026-11-21T07:00:00Z',
      source: 'manual',
      external_uid: 'spoof',
    })
    expect(error).not.toBeNull()
  })

  it('disconnecting a feed cascades to the events and deadlines it imported', async () => {
    const { userA, clientA } = await twoUsersSameHousehold()
    const { data: feed } = await clientA
      .from('mba_calendar_feeds')
      .insert({ user_id: userA.id, kind: 'lms', url: 'https://lms.example.com/feed.ics' })
      .select('id')
      .single()
    await clientA.from('mba_events').insert({
      user_id: userA.id, feed_id: feed!.id, external_uid: 'e1', title: 'x', starts_at: '2026-10-20T17:00:00Z',
    })
    await clientA.from('mba_deadlines').insert({
      user_id: userA.id, feed_id: feed!.id, title: 'y', due_at: '2026-10-20T17:00:00Z', source: 'lms', external_uid: 'd1',
    })

    expect((await clientA.from('mba_calendar_feeds').delete().eq('id', feed!.id)).error).toBeNull()
    expect((await clientA.from('mba_events').select('id')).data).toEqual([])
    expect((await clientA.from('mba_deadlines').select('id')).data).toEqual([])
  })

  it('a re-sync upsert does not reset the user-owned "done" flag', async () => {
    const { userA, clientA } = await twoUsersSameHousehold()
    const row = {
      user_id: userA.id, title: 'Group assignment', due_at: '2026-11-08T16:00:00Z', source: 'schedule', external_uid: 'mkt-group',
    }
    await clientA.from('mba_deadlines').insert(row)
    await clientA.from('mba_deadlines').update({ done: true }).eq('external_uid', 'mkt-group')

    // Same shape the sync sends (no `done` column).
    await clientA
      .from('mba_deadlines')
      .upsert({ ...row, title: 'Group assignment (renamed)' }, { onConflict: 'user_id,source,external_uid' })

    const { data } = await clientA.from('mba_deadlines').select('title, done').single()
    expect(data).toEqual({ title: 'Group assignment (renamed)', done: true })
  })
})
