'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { createHouseholdAction } from './actions'

export function CreateHouseholdForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await createHouseholdAction(formData)
    if (result && 'error' in result) {
      setError(result.error)
      setPending(false)
    }
    // On success the action redirects, so this component unmounts.
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-sage-800">
          Household name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. Our Place"
          className="w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200"
          disabled={pending}
        />
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating…' : 'Create household'}
      </Button>
    </form>
  )
}
