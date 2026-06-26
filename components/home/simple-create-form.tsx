'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type ActionResult = { error: string } | { success: true }

/**
 * Thin wrapper that handles the pending / error / success lifecycle (mirroring
 * the mortgage forms) for a server-action form. The fields are passed as
 * children so the project / list / shopping forms can share this shell.
 */
export function SimpleCreateForm({
  action,
  submitLabel,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  submitLabel: string
  children: ReactNode
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    setDone(false)
    const result = await action(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setDone(true)
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        {children}
      </fieldset>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      {done && <p className="text-sm text-sage-600">Added.</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}

export const homeInputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'
