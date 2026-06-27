'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { acceptInviteAction } from './actions'

export function AcceptInviteForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await acceptInviteAction(formData)
    if (result?.error) {
      setError(result.error)
      setPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? 'Joining…' : 'Accept invite'}
      </Button>
    </form>
  )
}
