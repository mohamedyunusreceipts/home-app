'use client'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export function SignInButton() {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setPending(false)
      console.error('Sign-in failed', error)
      alert(`Sign-in failed: ${error.message}`)
    }
    // On success, the browser navigates away to Google's OAuth page;
    // there's nothing to do here.
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? 'Redirecting…' : 'Sign in with Google'}
    </Button>
  )
}
