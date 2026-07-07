import { describe, it, expect, beforeEach } from 'vitest'
import {
  serviceClient,
  createTestUser,
  authedClient,
  resetDatabase,
} from '@/tests/helpers/supabase'

/**
 * RLS for the Qur'an module (Phase Q1). Both quran_progress and quran_hifz are
 * PER-USER (no household_id): a user can only read/write their OWN rows, even
 * when they share a household with the other user. Also verifies the
 * unique(user_id, surah_number) constraint on quran_hifz.
 */
describe("RLS — Qur'an per-user isolation", () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  /** Wait until the auth-trigger-created profile row exists (avoids FK races). */
  async function waitForProfile(id: string) {
    const service = serviceClient()
    for (let i = 0; i < 50; i++) {
      const { data } = await service.from('profiles').select('id').eq('id', id).maybeSingle()
      if (data) return
      await new Promise((r) => setTimeout(r, 50))
    }
    throw new Error(`profile ${id} never appeared`)
  }

  // Two users in the SAME household — the strongest per-user isolation case.
  async function twoUsersSameHousehold() {
    const userA = await createTestUser()
    const clientA = await authedClient(userA.email, userA.password)
    const { data: householdId, error } = await clientA.rpc('create_household', {
      p_name: 'Shared home',
    })
    if (error) throw new Error(`create_household failed: ${error.message}`)

    const userB = await createTestUser()
    const clientB = await authedClient(userB.email, userB.password)
    const { data: token, error: inviteErr } = await clientA.rpc('generate_invite')
    if (inviteErr) throw new Error(`generate_invite failed: ${inviteErr.message}`)
    const { error: joinErr } = await clientB.rpc('accept_invite', { p_token: token as string })
    if (joinErr) throw new Error(`accept_invite failed: ${joinErr.message}`)

    await waitForProfile(userA.id)
    await waitForProfile(userB.id)
    return { userA, clientA, userB, clientB, householdId: householdId as string }
  }

  // ── quran_progress ────────────────────────────────────────────────────────
  it('a user cannot read their partner\'s quran_progress (same household)', async () => {
    const { userA, clientA, clientB } = await twoUsersSameHousehold()

    const { error } = await clientA
      .from('quran_progress')
      .insert({ user_id: userA.id, current_level: 6 })
    expect(error).toBeNull()

    // Owner sees their own row.
    const { data: ownerView } = await clientA.from('quran_progress').select('*')
    expect(ownerView).toHaveLength(1)

    // Partner (same household) cannot see it — per-user, not household-scoped.
    const { data: partnerView } = await clientB.from('quran_progress').select('*')
    expect(partnerView).toHaveLength(0)
  })

  it('a user cannot insert quran_progress for another user', async () => {
    const { userB, clientA } = await twoUsersSameHousehold()
    const { error } = await clientA
      .from('quran_progress')
      .insert({ user_id: userB.id, current_level: 5 }) // not the caller
    expect(error).not.toBeNull()
  })

  // ── quran_hifz ──────────────────────────────────────────────────────────────
  it('a user cannot read their partner\'s quran_hifz rows (same household)', async () => {
    const { userA, clientA, clientB } = await twoUsersSameHousehold()

    const { error } = await clientA
      .from('quran_hifz')
      .insert({ user_id: userA.id, surah_number: 114, status: 'memorised' })
    expect(error).toBeNull()

    const { data: ownerView } = await clientA.from('quran_hifz').select('*')
    expect(ownerView).toHaveLength(1)

    const { data: partnerView } = await clientB.from('quran_hifz').select('*')
    expect(partnerView).toHaveLength(0)
  })

  it('a user cannot write a quran_hifz row owned by another user', async () => {
    const { userB, clientA } = await twoUsersSameHousehold()
    const { error } = await clientA
      .from('quran_hifz')
      .insert({ user_id: userB.id, surah_number: 112, status: 'learning' }) // not the caller
    expect(error).not.toBeNull()
  })

  it('rejects a duplicate (user_id, surah_number) with 23505', async () => {
    const { userA, clientA } = await twoUsersSameHousehold()

    const first = await clientA
      .from('quran_hifz')
      .insert({ user_id: userA.id, surah_number: 78, status: 'learning' })
    expect(first.error).toBeNull()

    const second = await clientA
      .from('quran_hifz')
      .insert({ user_id: userA.id, surah_number: 78, status: 'memorised' })
    expect(second.error).not.toBeNull()
    expect(second.error!.code).toBe('23505') // unique_violation
  })

  it('rejects an invalid hifz status (check constraint)', async () => {
    const { userA, clientA } = await twoUsersSameHousehold()
    const { error } = await clientA
      .from('quran_hifz')
      .insert({ user_id: userA.id, surah_number: 99, status: 'mastered' })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514') // check_violation
  })
})
