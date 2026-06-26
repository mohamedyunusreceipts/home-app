import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/push/unsubscribe
 *
 * Auth-gated. Deletes the caller's push subscription by `endpoint`. RLS already
 * scopes deletes to `user_id = auth.uid()`, so a user can only ever remove their
 * own subscription.
 *
 * Body: { endpoint: string }
 */

export const runtime = 'nodejs'

interface UnsubscribeBody {
  endpoint?: unknown
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: UnsubscribeBody
  try {
    body = (await request.json()) as UnsubscribeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const endpoint = body.endpoint
  if (typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'Expected { endpoint }' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
