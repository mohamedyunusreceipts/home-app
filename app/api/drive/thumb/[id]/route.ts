import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/drive/crypto'
import { DriveClient } from '@/lib/drive/DriveClient'

/**
 * GET /api/drive/thumb/[id]?size=NNN — proxies a Drive thumbnail (spec §5.5).
 *
 * Drive thumbnail URLs require the owner's credentials, so the browser can't fetch
 * them directly. This route auth-gates the request, then streams the thumbnail bytes
 * back through the server. The refresh token stays server-side.
 *
 * `id` is the Drive file id. `size` is the desired square pixel size (default 220).
 */

export const runtime = 'nodejs'

const DEFAULT_SIZE = 220

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const sizeParam = request.nextUrl.searchParams.get('size')
  const size = sizeParam ? Number.parseInt(sizeParam, 10) : DEFAULT_SIZE
  if (!Number.isFinite(size) || size <= 0 || size > 2048) {
    return NextResponse.json({ error: 'Invalid size' }, { status: 400 })
  }

  const supabase = await createClient()

  // Auth gate.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .limit(1)
    .maybeSingle<{ household_id: string }>()
  if (!membership) {
    return NextResponse.json({ error: 'No household' }, { status: 403 })
  }
  const householdId = membership.household_id

  const { data: household } = await supabase
    .from('households')
    .select('id, drive_refresh_token_encrypted')
    .eq('id', householdId)
    .maybeSingle<{ id: string; drive_refresh_token_encrypted: string | null }>()

  if (!household?.drive_refresh_token_encrypted) {
    return NextResponse.json(
      { error: 'Drive not connected', code: 'DRIVE_NOT_CONNECTED' },
      { status: 409 },
    )
  }

  const keyHex = process.env.DRIVE_TOKEN_ENCRYPTION_KEY
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!keyHex || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Drive integration is not configured on the server' },
      { status: 500 },
    )
  }

  let refreshToken: string
  try {
    refreshToken = decryptToken(household.drive_refresh_token_encrypted, keyHex)
  } catch {
    return NextResponse.json(
      { error: 'Stored Drive token could not be decrypted' },
      { status: 500 },
    )
  }

  const client = new DriveClient({
    refreshToken,
    clientId,
    clientSecret,
    supabase,
    householdId,
  })

  try {
    const thumbUrl = await client.getThumbnail(id, size)
    if (!thumbUrl) {
      return NextResponse.json({ error: 'No thumbnail' }, { status: 404 })
    }
    // Redirect to the (short-lived, signed) Drive thumbnail URL. The browser then
    // fetches the image directly; the URL itself carries no household secrets.
    return NextResponse.redirect(thumbUrl)
  } catch {
    return NextResponse.json(
      { error: 'Thumbnail fetch failed', code: 'DRIVE_THUMB_FAILED' },
      { status: 502 },
    )
  }
}
