'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  bondInstalment,
  extraPaymentPayoff,
  interestSplit,
} from '@/lib/mortgage/engine'
import { formatZar, formatDate } from './format'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200'

export type CalculatorDefaults = {
  /** Original / current principal to pre-fill. */
  principal: number
  annualRate: number
  termMonths: number
  instalment: number
  /** Current outstanding balance (latest statement) if available. */
  currentBalance: number
  /** Available redraw computed server-side, or null when no statements. */
  availableRedraw: number | null
}

function Field({
  label,
  value,
  onChange,
  step = '0.01',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  step?: string
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-sage-800">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  )
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-sage-100 py-1.5">
      <span className="text-sm text-sage-600">{label}</span>
      <span className="font-medium text-sage-800">{value}</span>
    </div>
  )
}

const n = (s: string) => {
  const v = Number(s)
  return Number.isFinite(v) ? v : 0
}

export function Calculators({ defaults }: { defaults: CalculatorDefaults }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BondRepaymentCalc defaults={defaults} />
      <ExtraPaymentCalc defaults={defaults} />
      <RedrawCalc defaults={defaults} />
      <InterestSplitCalc defaults={defaults} />
    </div>
  )
}

function BondRepaymentCalc({ defaults }: { defaults: CalculatorDefaults }) {
  const [principal, setPrincipal] = useState(String(defaults.principal || ''))
  const [rate, setRate] = useState(String(defaults.annualRate || ''))
  const [term, setTerm] = useState(String(defaults.termMonths || ''))

  const instalment = useMemo(() => {
    try {
      return bondInstalment(n(principal), n(rate), n(term))
    } catch {
      return null
    }
  }, [principal, rate, term])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-terracotta-700">
          Bond repayment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Principal (R)" value={principal} onChange={setPrincipal} />
        <Field label="Annual rate (%)" value={rate} onChange={setRate} />
        <Field label="Term (months)" value={term} onChange={setTerm} step="1" />
        <Result
          label="Monthly instalment"
          value={instalment == null ? '—' : formatZar(instalment)}
        />
      </CardContent>
    </Card>
  )
}

function ExtraPaymentCalc({ defaults }: { defaults: CalculatorDefaults }) {
  const [balance, setBalance] = useState(
    String(defaults.currentBalance || defaults.principal || ''),
  )
  const [rate, setRate] = useState(String(defaults.annualRate || ''))
  const [instalment, setInstalment] = useState(String(defaults.instalment || ''))
  const [extra, setExtra] = useState('1000')

  const result = useMemo(() => {
    try {
      return extraPaymentPayoff(n(balance), n(rate), n(instalment), n(extra))
    } catch {
      return null
    }
  }, [balance, rate, instalment, extra])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-terracotta-700">
          Extra-payment payoff
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Current balance (R)" value={balance} onChange={setBalance} />
        <Field label="Annual rate (%)" value={rate} onChange={setRate} />
        <Field label="Instalment (R / month)" value={instalment} onChange={setInstalment} />
        <Field label="Extra per month (R)" value={extra} onChange={setExtra} />
        {result ? (
          <div>
            <Result label="Months to payoff" value={String(result.monthsToPayoff)} />
            <Result label="Payoff date" value={formatDate(result.payoffDate)} />
            <Result label="Months saved" value={String(result.monthsSaved)} />
            <Result label="Interest saved" value={formatZar(result.interestSaved)} />
            <Result label="Total interest" value={formatZar(result.totalInterest)} />
          </div>
        ) : (
          <p className="text-sm text-sage-600">Enter values to see the payoff.</p>
        )}
      </CardContent>
    </Card>
  )
}

function RedrawCalc({ defaults }: { defaults: CalculatorDefaults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-terracotta-700">
          Available redraw
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sage-800">
        {defaults.availableRedraw == null ? (
          <p className="text-sm text-sage-600">
            Add at least one statement on the Statements page to calculate how much
            you can redraw.
          </p>
        ) : (
          <>
            <p className="font-serif text-3xl font-semibold text-terracotta-700">
              {formatZar(defaults.availableRedraw)}
            </p>
            <p className="text-sm text-sage-600">
              Based on your captured statements and original schedule. Capture a new
              statement to refresh this figure.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function InterestSplitCalc({ defaults }: { defaults: CalculatorDefaults }) {
  const [balance, setBalance] = useState(
    String(defaults.currentBalance || defaults.principal || ''),
  )
  const [rate, setRate] = useState(String(defaults.annualRate || ''))
  const [payment, setPayment] = useState(String(defaults.instalment || ''))

  const split = useMemo(() => {
    try {
      return interestSplit(n(balance), n(rate), n(payment))
    } catch {
      return null
    }
  }, [balance, rate, payment])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-terracotta-700">
          Interest split
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Balance (R)" value={balance} onChange={setBalance} />
        <Field label="Annual rate (%)" value={rate} onChange={setRate} />
        <Field label="Payment (R)" value={payment} onChange={setPayment} />
        {split ? (
          <div>
            <Result label="Goes to interest" value={formatZar(split.interest)} />
            <Result label="Goes to principal" value={formatZar(split.principal)} />
          </div>
        ) : (
          <p className="text-sm text-sage-600">Enter values to see the split.</p>
        )}
      </CardContent>
    </Card>
  )
}
