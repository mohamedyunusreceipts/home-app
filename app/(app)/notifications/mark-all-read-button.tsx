'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { markAllReadAction } from './actions'

/** Client button that marks every notification read and refreshes the page. */
export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      await markAllReadAction()
      router.refresh()
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || pending}
    >
      {pending ? 'Marking…' : 'Mark all read'}
    </Button>
  )
}
