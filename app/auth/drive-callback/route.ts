import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/drive/crypto'
import { DriveClient } from '@/lib/drive/DriveClient'
import { DRIVE_ROOT, cacheFolderId } from '@/lib/drive/folders'

/**
 * GET /auth/drive-callback — completes the Google Drive connect flow (deferred /
 * gated feature). Reached after the owner taps "Connect Google Drive" on Settings
 * and approves the `drive.file` scope on Google's consent screen.
 *
 * Steps:
 *   1. Exchange the OAuth `code` for a Supabase session (server client).
 *   2. Read the Google *provider refresh token* off that session.
 *   3. Encrypt it (DRIVE_TOKEN_ENCRYPTION_KEY) and store it on the caller's
 *      household (`drive_refresh_token_encrypted`).
 *   4. Instantiate DriveClient and ensure the `/HomeApp` root folder exists,
 *      storing its id in `drive_root_folder_id` (and caching the path).
 *   5. Redirect to /settings?drive=connected.
 *
 * Any failure (missing key/client config, no refresh token, Drive API error)
 * redirects to /settings?drive=error rather than crashing. The Settings Drive
 * card surfaces both outcomes as a toast.
 *
 * Runs on Node (Drive client uses node `crypto` + `stream`).
 */
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const error = `${origin}/settings?drive=error`
  const success = `${origin}/settings?drive=connected`

  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(error)

  const supabase = await createClient()

  // 1. Exchange the code; the returned session carries the Google provider tokens.
  const { data: exchange, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError || !exchange.session) {
    return NextResponse.redirect(error)
  }

  const refreshToken = exchange.session.provider_refresh_token
  const user = exchange.session.user
  if (!refreshToken || !user) {
    // Google didn't return an offline refresh token (e.g. consent not re-granted).
    return NextResponse.redirect(error)
  }

  // Resolve the caller's household (RLS scopes this to them).
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle<{ household_id: string; role: string }>()
  if (!membership || membership.role !== 'owner') {
    return NextResponse.redirect(error)
  }
  const householdId = membership.household_id

  // Server-only secrets, read at request time.
  const keyHex = process.env.DRIVE_TOKEN_ENCRYPTION_KEY
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!keyHex || !clientId || !clientSecret) {
    return NextResponse.redirect(error)
  }

  try {
    // 2 + 3. Encrypt and persist the refresh token. PostgREST writes a bytea
    // column from a Postgres hex-escape string (`\x<hex>`); on read it returns
    // the bytes base64-encoded, which decryptToken (used by the Drive routes)
    // handles. This keeps write/read symmetric.
    const encrypted = encryptToken(refreshToken, keyHex)
    const encryptedHex = `\\x${encrypted.toString('hex')}`
    const { error: tokenError } = await supabase
      .from('households')
      .update({ drive_refresh_token_encrypted: encryptedHex })
      .eq('id', householdId)
    if (tokenError) return NextResponse.redirect(error)

    // 4. Ensure the /HomeApp root folder exists and remember its id.
    const client = new DriveClient({
      refreshToken,
      clientId,
      clientSecret,
      supabase,
      householdId,
    })
    const rootFolderId = await client.ensureFolder(DRIVE_ROOT)

    const { error: folderError } = await supabase
      .from('households')
      .update({ drive_root_folder_id: rootFolderId })
      .eq('id', householdId)
    if (folderError) return NextResponse.redirect(error)

    // Seed the folder cache so the resolver doesn't re-create the root.
    await cacheFolderId(supabase, householdId, `/${DRIVE_ROOT}`, rootFolderId)

    return NextResponse.redirect(success)
  } catch {
    // Drive API failure / decrypt-store failure — degrade gracefully.
    return NextResponse.redirect(error)
  }
}
