'use client'

import { useMemo, useState } from 'react'
import { buildRrule, describeRrule, type RecurrenceFreq, type Weekday } from '@/lib/rrule'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

const WEEKDAYS: { code: Weekday; label: string }[] = [
  { code: 'MO', label: 'Mon' },
  { code: 'TU', label: 'Tue' },
  { code: 'WE', label: 'Wed' },
  { code: 'TH', label: 'Thu' },
  { code: 'FR', label: 'Fri' },
  { code: 'SA', label: 'Sat' },
  { code: 'SU', label: 'Sun' },
]

/**
 * Recurrence builder (design spec §9.3). Lets the user pick a daily / weekly /
 * monthly cadence with an interval (and weekdays for weekly rules), builds an
 * RFC 5545 RRULE string via lib/rrule.buildRrule, and renders the human
 * description via describeRrule. The built RRULE is written into a hidden input
 * named `name` so it submits with the enclosing server-action form.
 */
export function RecurrenceBuilder({
  name = 'recurrence_rrule',
  disabled = false,
}: {
  name?: string
  disabled?: boolean
}) {
  const [freq, setFreq] = useState<RecurrenceFreq>('weekly')
  const [interval, setInterval] = useState(1)
  const [weekdays, setWeekdays] = useState<Weekday[]>(['MO'])

  function toggleWeekday(code: Weekday) {
    setWeekdays((prev) =>
      prev.includes(code) ? prev.filter((w) => w !== code) : [...prev, code],
    )
  }

  const rrule = useMemo(() => {
    try {
      return buildRrule({
        freq,
        interval: interval >= 1 ? interval : 1,
        weekdays: freq === 'weekly' && weekdays.length > 0 ? weekdays : undefined,
      })
    } catch {
      return ''
    }
  }, [freq, interval, weekdays])

  const description = useMemo(() => {
    if (!rrule) return ''
    try {
      return describeRrule(rrule)
    } catch {
      return ''
    }
  }, [rrule])

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={rrule} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-sage-800">Repeats</label>
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}
            className={inputClass}
            disabled={disabled}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-sage-800">Every</label>
          <input
            type="number"
            min={1}
            value={interval}
            onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
            className={inputClass}
            disabled={disabled}
          />
        </div>
      </div>

      {freq === 'weekly' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-sage-800">On days</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const active = weekdays.includes(d.code)
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => toggleWeekday(d.code)}
                  disabled={disabled}
                  className={
                    active
                      ? 'rounded-md border border-terracotta-400 bg-terracotta-400 px-2.5 py-1 text-sm text-cream-50'
                      : 'rounded-md border border-sage-300 bg-cream-50 px-2.5 py-1 text-sm text-sage-800 hover:bg-sage-50'
                  }
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-sm text-sage-600">
        {description ? `Repeats ${description}.` : 'Pick a cadence above.'}
      </p>
    </div>
  )
}
