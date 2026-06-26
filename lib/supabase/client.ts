import { createBrowserClient } from '@supabase/ssr'

// IMPORTANT: NEXT_PUBLIC_* vars must be referenced as STATIC member expressions
// (process.env.NEXT_PUBLIC_FOO) so Next.js inlines them into the client bundle at
// build time. A dynamic lookup (process.env[name], as in lib/env.ts) is NOT
// replaced on the client and would be undefined in the browser — which crashes the
// browser Supabase client on load. So we read them directly here rather than via
// lib/env (that helper is server-only).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in the client bundle. ' +
        'Ensure both are set in the build environment (they are inlined at build time).',
    )
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
