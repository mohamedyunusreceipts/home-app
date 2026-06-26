import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * RLS isolation for the Vault module (spec §9.7).
 * One household-A-vs-B isolation check per table, plus the gift_ideas
 * recipient-hiding rule. Mirrors tests/integration/mortgage/mortgage-rls.test.ts.
 *
 * NOTE: written but NOT run here — migrations + the full suite run centrally.
 */
describe('RLS — vault isolation', () => {
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

  // A second user joining the SAME household, so we can test gift recipient hiding.
  // generate_invite scopes to the inviter's own household, so no id is needed.
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

  // ── documents ───────────────────────────────────────────────────────────────
  it("household B cannot read or write household A's documents", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('documents').insert({
      household_id: a.householdId,
      name: 'Lease',
      kind: 'contract',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('documents').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('documents').insert({
      household_id: a.householdId,
      name: 'Sneaky',
      kind: 'other',
    })
    expect(bWrite).not.toBeNull()
  })

  // ── emergency_contacts ────────────────────────────────────────────────────────
  it("household B cannot read or write household A's emergency contacts", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('emergency_contacts').insert({
      household_id: a.householdId,
      name: 'Dr Smith',
      is_medical: true,
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('emergency_contacts').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('emergency_contacts').insert({
      household_id: a.householdId,
      name: 'Intruder',
    })
    expect(bWrite).not.toBeNull()
  })

  // ── vehicles ────────────────────────────────────────────────────────────────
  it("household B cannot read or write household A's vehicles", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('vehicles').insert({
      household_id: a.householdId,
      label: 'Hilux',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('vehicles').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('vehicles').insert({
      household_id: a.householdId,
      label: 'Stolen',
    })
    expect(bWrite).not.toBeNull()
  })

  // ── vehicle_docs ──────────────────────────────────────────────────────────────
  it("household B cannot read or write household A's vehicle docs", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { data: vehicle } = await a.client
      .from('vehicles')
      .insert({ household_id: a.householdId, label: 'Hilux' })
      .select()
      .single()

    const { error: aInsert } = await a.client.from('vehicle_docs').insert({
      household_id: a.householdId,
      vehicle_id: vehicle!.id,
      kind: 'insurance',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('vehicle_docs').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('vehicle_docs').insert({
      household_id: a.householdId,
      vehicle_id: vehicle!.id,
      kind: 'insurance',
    })
    expect(bWrite).not.toBeNull()
  })

  // ── warranties ────────────────────────────────────────────────────────────────
  it("household B cannot read or write household A's warranties", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('warranties').insert({
      household_id: a.householdId,
      item: 'Dishwasher',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('warranties').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('warranties').insert({
      household_id: a.householdId,
      item: 'Sneaky',
    })
    expect(bWrite).not.toBeNull()
  })

  // ── gift_ideas: tenant isolation ──────────────────────────────────────────────
  it("household B cannot read or write household A's gift ideas", async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const { error: aInsert } = await a.client.from('gift_ideas').insert({
      household_id: a.householdId,
      idea: 'Watch',
    })
    expect(aInsert).toBeNull()

    const { data: bRead } = await b.client.from('gift_ideas').select('*')
    expect(bRead).toHaveLength(0)

    const { error: bWrite } = await b.client.from('gift_ideas').insert({
      household_id: a.householdId,
      idea: 'Intruder gift',
    })
    expect(bWrite).not.toBeNull()
  })

  // ── gift_ideas: recipient-hiding rule (spec §9.7) ─────────────────────────────
  it('the recipient of a gift cannot see it, but other household members can', async () => {
    const a = await makeHousehold('A')
    const { partner, partnerClient } = await addPartner(a.client)

    // Owner logs a gift FOR the partner.
    const { error: insErr } = await a.client.from('gift_ideas').insert({
      household_id: a.householdId,
      for_user_id: partner.id,
      idea: 'Surprise watch',
    })
    expect(insErr).toBeNull()

    // The owner (a co-member, not the recipient) CAN see it.
    const { data: ownerView } = await a.client.from('gift_ideas').select('*')
    expect(ownerView).toHaveLength(1)
    expect(ownerView![0]!.idea).toBe('Surprise watch')

    // The recipient (partner) CANNOT see it.
    const { data: recipientView } = await partnerClient.from('gift_ideas').select('*')
    expect(recipientView).toHaveLength(0)
  })

  it('a gift with no recipient (for_user_id null) is visible to all household members', async () => {
    const a = await makeHousehold('A')
    const { partnerClient } = await addPartner(a.client)

    const { error: insErr } = await a.client.from('gift_ideas').insert({
      household_id: a.householdId,
      idea: 'Generic idea',
    })
    expect(insErr).toBeNull()

    const { data: ownerView } = await a.client.from('gift_ideas').select('*')
    expect(ownerView).toHaveLength(1)

    const { data: partnerView } = await partnerClient.from('gift_ideas').select('*')
    expect(partnerView).toHaveLength(1)
  })
})
