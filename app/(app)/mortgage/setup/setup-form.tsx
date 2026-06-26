'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { upsertBondAction } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

export type BondDefaults = {
  lender: string
  accountRef: string
  startDate: string
  originalPrincipal: string
  termMonths: string
  contractualInstalment: string
  currentAnnualRate: string
  rateIsPrimeLinked: boolean
  primeDelta: string
}

export function SetupForm({ defaults }: { defaults: BondDefaults }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [primeLinked, setPrimeLinked] = useState(defaults.rateIsPrimeLinked)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await upsertBondAction(formData)
    if (result && 'error' in result) {
      setError(result.error)
      setPending(false)
    }
    // On success the action redirects, so this component unmounts.
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="lender" className="block text-sm font-medium text-sage-800">
          Lender
        </label>
        <input
          id="lender"
          name="lender"
          type="text"
          required
          maxLength={80}
          defaultValue={defaults.lender}
          placeholder="e.g. ABSA, FNB, Standard Bank"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="account_ref" className="block text-sm font-medium text-sage-800">
          Account reference <span className="text-sage-500">(optional)</span>
        </label>
        <input
          id="account_ref"
          name="account_ref"
          type="text"
          maxLength={80}
          defaultValue={defaults.accountRef}
          placeholder="e.g. 1234567890"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="original_principal"
          className="block text-sm font-medium text-sage-800"
        >
          Original principal (R)
        </label>
        <input
          id="original_principal"
          name="original_principal"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          defaultValue={defaults.originalPrincipal}
          placeholder="e.g. 1500000"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="start_date" className="block text-sm font-medium text-sage-800">
          Start date
        </label>
        <input
          id="start_date"
          name="start_date"
          type="date"
          required
          defaultValue={defaults.startDate}
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="term_months" className="block text-sm font-medium text-sage-800">
          Term (months)
        </label>
        <input
          id="term_months"
          name="term_months"
          type="number"
          inputMode="numeric"
          step="1"
          min="1"
          required
          defaultValue={defaults.termMonths}
          placeholder="e.g. 240"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="contractual_instalment"
          className="block text-sm font-medium text-sage-800"
        >
          Contractual instalment (R / month)
        </label>
        <input
          id="contractual_instalment"
          name="contractual_instalment"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          defaultValue={defaults.contractualInstalment}
          placeholder="e.g. 15500"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="current_annual_rate"
          className="block text-sm font-medium text-sage-800"
        >
          Current annual rate (%)
        </label>
        <input
          id="current_annual_rate"
          name="current_annual_rate"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          required
          defaultValue={defaults.currentAnnualRate}
          placeholder="e.g. 11.25"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2 rounded-md border border-sage-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
          <input
            name="rate_is_prime_linked"
            type="checkbox"
            checked={primeLinked}
            onChange={(e) => setPrimeLinked(e.target.checked)}
            className="size-4 accent-terracotta-500"
            disabled={pending}
          />
          Rate is prime-linked
        </label>

        {primeLinked && (
          <div className="space-y-2 pt-1">
            <label
              htmlFor="prime_delta"
              className="block text-sm font-medium text-sage-800"
            >
              Margin vs prime (%)
            </label>
            <input
              id="prime_delta"
              name="prime_delta"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={defaults.primeDelta}
              placeholder="e.g. -0.5 for prime minus 0.5%"
              className={inputClass}
              disabled={pending}
            />
            <p className="text-xs text-sage-600">
              Use a negative value for prime minus, positive for prime plus.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Save bond'}
      </Button>
    </form>
  )
}
