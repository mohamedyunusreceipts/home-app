import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'
import { computeSplits } from '@/components/money/split'
import { computeWhoOwesWho } from '@/components/money/balance'

/**
 * Split-expense end-to-end (design spec §11): insert an expense + its splits the
 * same way the server action does, read them back, and confirm the live
 * who-owes-who balance reconciles. Written but NOT run here — central suite.
 */
describe('Money — split expense end-to-end', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  // A two-person household: owner creates it, partner joins via invite RPCs.
  async function makeCouple() {
    const owner = await createTestUser()
    const ownerClient = await authedClient(owner.email, owner.password)
    const { data: householdId, error: hhErr } = await ownerClient.rpc('create_household', {
      p_name: 'Couple',
    })
    if (hhErr) throw new Error(`create_household failed: ${hhErr.message}`)

    const { data: token, error: invErr } = await ownerClient.rpc('generate_invite')
    if (invErr) throw new Error(`generate_invite failed: ${invErr.message}`)

    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)
    const { error: acceptErr } = await partnerClient.rpc('accept_invite', { p_token: token })
    if (acceptErr) throw new Error(`accept_invite failed: ${acceptErr.message}`)

    return {
      householdId: householdId as string,
      owner,
      ownerClient,
      partner,
      partnerClient,
    }
  }

  it('inserts an equal-split expense and reads the splits back', async () => {
    const c = await makeCouple()

    const shares = computeSplits(100, 'equal', {
      meUserId: c.owner.id,
      partnerUserId: c.partner.id,
    })

    const { data: expense, error: expErr } = await c.ownerClient
      .from('expenses')
      .insert({
        household_id: c.householdId,
        date: '2026-06-01',
        amount: 100,
        category: 'Groceries',
        paid_by_user_id: c.owner.id,
        split_type: 'equal',
        description: 'Weekly shop',
      })
      .select()
      .single()
    expect(expErr).toBeNull()

    const splitPayload = shares.map((s) => ({
      household_id: c.householdId,
      expense_id: expense!.id,
      user_id: s.userId,
      share_amount: s.shareAmount,
    }))
    const { error: splitErr } = await c.ownerClient.from('expense_splits').insert(splitPayload)
    expect(splitErr).toBeNull()

    // Read back from the partner's client — they share the household, so RLS allows it.
    const { data: readExpenses } = await c.partnerClient.from('expenses').select('*')
    const { data: readSplits } = await c.partnerClient.from('expense_splits').select('*')
    expect(readExpenses).toHaveLength(1)
    expect(readSplits).toHaveLength(2)

    // The live balance: partner owes the owner 50.
    const balance = computeWhoOwesWho(
      (readExpenses ?? []).map((e) => ({
        id: e.id,
        paidByUserId: e.paid_by_user_id,
        amount: e.amount,
      })),
      (readSplits ?? []).map((s) => ({
        expenseId: s.expense_id,
        userId: s.user_id,
        shareAmount: s.share_amount,
      })),
      [c.owner.id, c.partner.id],
    )
    expect(balance.debtorUserId).toBe(c.partner.id)
    expect(balance.creditorUserId).toBe(c.owner.id)
    expect(balance.amount).toBe(50)
  })
})
