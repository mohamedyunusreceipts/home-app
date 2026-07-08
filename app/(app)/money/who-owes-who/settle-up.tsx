'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useShell } from '@/components/shell/shell-context'
import { formatZar, formatDate } from '@/components/money/format'
import type { SettlementRow, SettlementPlanRow, MemberOption } from '@/components/money/map'
import { displayName } from '@/components/money/members'
import {
  recordSettlementAction,
  savePaymentPlanAction,
  cancelPaymentPlanAction,
} from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

type Props = {
  currentUserId: string
  members: MemberOption[]
  /** Who currently owes (null when square). */
  owerId: string | null
  /** Who is currently owed (null when square). */
  owedId: string | null
  /** Positive outstanding amount (0 = square). */
  outstanding: number
  /** Original split-derived debt in the current direction (for the progress bar). */
  originalOwed: number
  /** Repayment history, newest first. */
  settlements: SettlementRow[]
  /** The active plan in the current ower's direction, if any. */
  activePlan: SettlementPlanRow | null
  /** Today as YYYY-MM-DD in the app timezone. */
  today: string
}

export function SettleUp({
  currentUserId,
  members,
  owerId,
  owedId,
  outstanding,
  originalOwed,
  settlements,
  activePlan,
  today,
}: Props) {
  const router = useRouter()
  const { showToast } = useShell()

  const [repayPending, setRepayPending] = useState(false)
  const [repayError, setRepayError] = useState<string | null>(null)
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '')

  const [planPending, setPlanPending] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)

  const square = outstanding <= 0 || owerId == null || owedId == null
  // Only the person who currently owes can record a repayment / run a plan.
  const iAmOwer = !square && owerId === currentUserId

  const repaid = originalOwed > 0 ? Math.max(0, originalOwed - outstanding) : 0
  const progressPct =
    originalOwed > 0 ? Math.min(100, Math.round((repaid / originalOwed) * 100)) : 0

  async function handleRepay(formData: FormData) {
    setRepayPending(true)
    setRepayError(null)
    const result = await recordSettlementAction(formData)
    setRepayPending(false)
    if ('error' in result) {
      setRepayError(result.error)
      return
    }
    showToast('Repayment recorded')
    setAmount('')
    router.refresh()
  }

  async function handleSavePlan(formData: FormData) {
    setPlanPending(true)
    setPlanError(null)
    const result = await savePaymentPlanAction(formData)
    setPlanPending(false)
    if ('error' in result) {
      setPlanError(result.error)
      return
    }
    showToast('Payment plan saved')
    router.refresh()
  }

  async function handleCancelPlan(formData: FormData) {
    setPlanPending(true)
    setPlanError(null)
    const result = await cancelPaymentPlanAction(formData)
    setPlanPending(false)
    if ('error' in result) {
      setPlanError(result.error)
      return
    }
    showToast('Payment plan cancelled')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Record a repayment — only for the person who owes. */}
      {iAmOwer && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Record a repayment</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleRepay} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="amount" className="block text-sm font-medium text-sage-800">
                    Amount (R)
                  </label>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={inputClass}
                    disabled={repayPending}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="occurred_on" className="block text-sm font-medium text-sage-800">
                    Date
                  </label>
                  <input
                    id="occurred_on"
                    name="occurred_on"
                    type="date"
                    required
                    defaultValue={today}
                    className={inputClass}
                    disabled={repayPending}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label htmlFor="note" className="block text-sm font-medium text-sage-800">
                    Note <span className="text-sage-500">(optional)</span>
                  </label>
                  <input
                    id="note"
                    name="note"
                    type="text"
                    maxLength={200}
                    placeholder="e.g. EFT reference"
                    className={inputClass}
                    disabled={repayPending}
                  />
                </div>
              </div>
              {repayError && (
                <p className="text-sm text-terracotta-700" role="alert">
                  {repayError}
                </p>
              )}
              <Button type="submit" disabled={repayPending} className="w-full">
                {repayPending ? 'Recording…' : `Repay ${displayName(owedId!, members, currentUserId)}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Payment plan — only for the person who owes. */}
      {iAmOwer && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Payment plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar (repaid vs original owed). */}
            {originalOwed > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-sage-600">
                  <span>Repaid {formatZar(repaid)}</span>
                  <span>of {formatZar(originalOwed)}</span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-sage-100"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-sage-500 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {activePlan ? (
              <div className="space-y-3">
                <p className="text-sm text-sage-700">
                  Next installment:{' '}
                  <span className="font-medium text-sage-900">{formatDate(activePlan.next_due)}</span>{' '}
                  · <span className="font-medium text-sage-900">{formatZar(activePlan.installment_amount)}</span>
                </p>
                <form action={handleCancelPlan}>
                  <input type="hidden" name="plan_id" value={activePlan.id} />
                  <Button type="submit" variant="outline" disabled={planPending}>
                    {planPending ? 'Cancelling…' : 'Cancel plan'}
                  </Button>
                </form>
              </div>
            ) : (
              <form action={handleSavePlan} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label
                      htmlFor="installment_amount"
                      className="block text-sm font-medium text-sage-800"
                    >
                      Installment (R)
                    </label>
                    <input
                      id="installment_amount"
                      name="installment_amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      required
                      className={inputClass}
                      disabled={planPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="frequency" className="block text-sm font-medium text-sage-800">
                      Frequency
                    </label>
                    <select
                      id="frequency"
                      name="frequency"
                      required
                      defaultValue="monthly"
                      className={inputClass}
                      disabled={planPending}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="next_due" className="block text-sm font-medium text-sage-800">
                      Start date
                    </label>
                    <input
                      id="next_due"
                      name="next_due"
                      type="date"
                      required
                      defaultValue={today}
                      className={inputClass}
                      disabled={planPending}
                    />
                  </div>
                </div>
                {planError && (
                  <p className="text-sm text-terracotta-700" role="alert">
                    {planError}
                  </p>
                )}
                <Button type="submit" disabled={planPending} className="w-full">
                  {planPending ? 'Saving…' : 'Set up payment plan'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Repayment history — visible to both members. */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700">Repayment history</CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <p className="text-sm text-sage-600">No repayments logged yet.</p>
          ) : (
            <ul className="divide-y divide-sage-100">
              {settlements.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-sage-900">
                      {displayName(s.from_user_id, members, currentUserId)} →{' '}
                      {displayName(s.to_user_id, members, currentUserId)}
                    </p>
                    <p className="text-xs text-sage-500">
                      {formatDate(s.occurred_on)}
                      {s.note ? ` · ${s.note}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums text-sage-800">
                    {formatZar(s.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
