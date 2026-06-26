'use client'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export function SignInButton({ nextPath }: { nextPath?: string }) {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    const supabase = createClient()
    const callbackParams = new URLSearchParams()
    if (nextPath && nextPath.startsWith('/')) callbackParams.set('next', nextPath)
    const callbackUrl = `${window.location.origin}/auth/callback${
      callbackParams.toString() ? '?' + callbackParams.toString() : ''
    }`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })
    if (error) {
      setPending(false)
      alert(`Sign-in failed: ${error.message}`)
    }
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? 'Redirecting…' : 'Sign in with Google'}
    </Button>
  )
}
