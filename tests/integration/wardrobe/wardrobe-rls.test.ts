import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * RLS for the Wardrobe module (spec §9.6). Covers:
 *  - tenant isolation across households for all three tables;
 *  - the per-user privacy rule on wardrobe_items: a partner cannot see an item
 *    with visible_to_partner=false, the owner always can, and shared items are
 *    visible to the partner;
 *  - WITH CHECK: you can only create/modify your OWN items;
 *  - wardrobe_preferences is strictly per-user (own row only).
 *
 * Mirrors tests/integration/{mortgage,vault}-rls. WRITTEN BUT NOT RUN here —
 * migrations + the full suite run centrally.
 */
describe('RLS — wardrobe isolation & per-user privacy', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function makeHousehold(name: string) {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)
    const { data: householdId, error } = await client.rpc('create_household', { p_name: name })
    if (error) throw new Error(`create_household failed: ${error.message}`)
    return { user, client, householdId: householdId as string }
  }

  // A second user joining the SAME household, so we can test per-user privacy.
  async function addPartner(client: SupabaseClient) {
    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)
    const { data: token, error: inviteErr } = await client.rpc('generate_invite')
    if (inviteErr) throw new Error(`generate_invite failed: ${inviteErr.message}`)
    const { error: joinErr } = await partnerClient.rpc('accept_invite', {
      p_token: token as string,
    })
    if (joinErr) throw new Error(`accept_invite failed: ${joinErr.message}`)
    return { partner, partnerClient }
  }

  function insertItem(
    client: SupabaseClient,
    householdId: string,
    ownerUserId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return client
      .from('wardrobe_items')
      .insert({
        household_id: householdId,
        owner_user_id: ownerUserId,
        category: 'top',
        visible_to_partner: true,
        ...overrides,
      })
      .select()
      .single()
  }

  // ── tenant isolation: wardrobe_items ──────────────────────────────────────────
  it("household B cannot read or write household A's wardrobe items", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await insertItem(a.client, a.householdId, a.user.id)
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('wardrobe_items').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await insertItem(b.client, a.householdId, b.user.id)
    expect(bWrite).not.toBeNull()
  })

  // ── WITH CHECK: can only create your OWN items ────────────────────────────────
  it('a member cannot insert an item owned by their partner', async () => {
    const a = await makeHousehold('A')
    const { partner } = await addPartner(a.client)

    // Owner A tries to create an item owned by the partner → WITH CHECK blocks it.
    const { error } = await insertItem(a.client, a.householdId, partner.id)
    expect(error).not.toBeNull()
  })

  // ── per-user privacy: private item hidden from partner, visible to owner ──────
  it('a partner cannot see an item with visible_to_partner=false, but the owner can', async () => {
    const a = await makeHousehold('A')
    const { partnerClient } = await addPartner(a.client)

    const { error } = await insertItem(a.client, a.householdId, a.user.id, {
      category: 'underwear',
      visible_to_partner: false,
    })
    expect(error).toBeNull()

    // Owner sees their own private item.
    const { data: ownerView } = await a.client.from('wardrobe_items').select('*')
    expect(ownerView).toHaveLength(1)

    // Partner does NOT see it.
    const { data: partnerView } = await partnerClient.from('wardrobe_items').select('*')
    expect(partnerView).toHaveLength(0)
  })

  // ── per-user privacy: shared item is visible to the partner ───────────────────
  it('a shared item (visible_to_partner=true) is visible to the partner', async () => {
    const a = await makeHousehold('A')
    const { partnerClient } = await addPartner(a.client)

    const { error } = await insertItem(a.client, a.householdId, a.user.id, {
      category: 'top',
      visible_to_partner: true,
    })
    expect(error).toBeNull()

    const { data: partnerView } = await partnerClient.from('wardrobe_items').select('*')
    expect(partnerView).toHaveLength(1)
  })

  // ── per-user privacy: partner cannot flip another's item to visible ───────────
  it("a partner cannot update the owner's item (WITH CHECK / owner-only)", async () => {
    const a = await makeHousehold('A')
    const { partnerClient } = await addPartner(a.client)

    const { data: item } = await insertItem(a.client, a.householdId, a.user.id, {
      visible_to_partner: true,
    })

    // Partner attempts to edit the owner's item. The update matches no visible row
    // for the partner (or is blocked by WITH CHECK), so nothing changes.
    const { data: updated } = await partnerClient
      .from('wardrobe_items')
      .update({ color: 'hacked' })
      .eq('id', item!.id)
      .select()
    expect(updated ?? []).toHaveLength(0)

    const { data: afterOwner } = await a.client
      .from('wardrobe_items')
      .select('color')
      .eq('id', item!.id)
      .single()
    expect(afterOwner!.color).not.toBe('hacked')
  })

  // ── tenant isolation: outfits ─────────────────────────────────────────────────
  it("household B cannot read or write household A's outfits", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('outfits').insert({
      household_id: a.householdId,
      owner_user_id: a.user.id,
      name: 'Weekend look',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('outfits').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('outfits').insert({
      household_id: a.householdId,
      owner_user_id: b.user.id,
      name: 'Intruder',
    })
    expect(bWrite).not.toBeNull()
  })

  it('a partner can VIEW outfits within the household but cannot create one as the owner', async () => {
    const a = await makeHousehold('A')
    const { partnerClient } = await addPartner(a.client)

    await a.client.from('outfits').insert({
      household_id: a.householdId,
      owner_user_id: a.user.id,
      name: 'Shared look',
    })

    // Partner can read it (tenant-isolated, owner-writable USING clause).
    const { data: partnerView } = await partnerClient.from('outfits').select('*')
    expect(partnerView).toHaveLength(1)

    // Partner cannot create an outfit owned by someone else (WITH CHECK).
    const { error } = await partnerClient.from('outfits').insert({
      household_id: a.householdId,
      owner_user_id: a.user.id, // not the partner
      name: 'Spoofed owner',
    })
    expect(error).not.toBeNull()
  })

  // ── wardrobe_preferences: strictly per-user ───────────────────────────────────
  it("a partner cannot read another user's wardrobe_preferences", async () => {
    const a = await makeHousehold('A')
    const { partnerClient } = await addPartner(a.client)

    const { error } = await a.client.from('wardrobe_preferences').insert({
      user_id: a.user.id,
      sizes: { tops: 'M' },
      style_notes_md: 'private notes',
    })
    expect(error).toBeNull()

    // Owner reads their own row.
    const { data: ownerView } = await a.client.from('wardrobe_preferences').select('*')
    expect(ownerView).toHaveLength(1)

    // Partner (same household) cannot read it — it is per-user, not household-scoped.
    const { data: partnerView } = await partnerClient.from('wardrobe_preferences').select('*')
    expect(partnerView).toHaveLength(0)
  })

  it('a user cannot insert wardrobe_preferences for another user', async () => {
    const a = await makeHousehold('A')
    const { partner } = await addPartner(a.client)

    const { error } = await a.client.from('wardrobe_preferences').insert({
      user_id: partner.id, // not the caller
      sizes: { tops: 'L' },
    })
    expect(error).not.toBeNull()
  })

  // ── check constraints ─────────────────────────────────────────────────────────
  it('rejects an invalid category', async () => {
    const a = await makeHousehold('A')
    const { error } = await insertItem(a.client, a.householdId, a.user.id, {
      category: 'not_a_category',
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514') // check_violation
  })

  it('rejects an invalid laundry_status', async () => {
    const a = await makeHousehold('A')
    const { error } = await insertItem(a.client, a.householdId, a.user.id, {
      laundry_status: 'soaking',
    })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514') // check_violation
  })
})
