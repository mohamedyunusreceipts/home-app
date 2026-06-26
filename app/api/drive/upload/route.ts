import { NextResponse, type NextRequest } from 'next/server'
import { Readable } from 'stream'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/drive/crypto'
import { DriveClient } from '@/lib/drive/DriveClient'
import type { DriveModule } from '@/lib/drive/folders'

/**
 * POST /api/drive/upload — server-side Drive upload (spec §5.5).
 *
 * Browser → this route → Drive, so the refresh token never reaches the client.
 * Flow:
 *   1. Auth-gate via the server Supabase client (reject anonymous / household-less).
 *   2. Read the household's encrypted Drive refresh token.
 *      - If none configured → 409 "Drive not connected" (the OAuth connect flow is
 *        deferred / gated on Google setup; this route does NOT perform the OAuth dance).
 *   3. Decrypt the token server-side, instantiate DriveClient, upload.
 *
 * Expects multipart/form-data with: `file` (Blob), `module`, optional `subcategory`.
 */

export const runtime = 'nodejs'

const VALID_MODULES: readonly DriveModule[] = [
  'Documents',
  'Money',
  'Food',
  'Home',
  'Travel',
  'Wardrobe',
  'Calendar',
]

interface HouseholdTokenRow {
  id: string
  drive_refresh_token_encrypted: string | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Auth gate.
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

  // 2. Read the household's encrypted Drive token (RLS scopes this to the caller).
  const { data: household } = await supabase
    .from('households')
    .select('id, drive_refresh_token_encrypted')
    .eq('id', householdId)
    .maybeSingle<HouseholdTokenRow>()

  if (!household?.drive_refresh_token_encrypted) {
    return NextResponse.json(
      { error: 'Drive not connected', code: 'DRIVE_NOT_CONNECTED' },
      { status: 409 },
    )
  }

  // 3. Parse the upload.
  const form = await request.formData()
  const file = form.get('file')
  const moduleRaw = form.get('module')
  const subcategoryRaw = form.get('subcategory')

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (
    typeof moduleRaw !== 'string' ||
    !VALID_MODULES.includes(moduleRaw as DriveModule)
  ) {
    return NextResponse.json({ error: 'Invalid module' }, { status: 400 })
  }
  const driveModule = moduleRaw as DriveModule
  const subcategory =
    typeof subcategoryRaw === 'string' && subcategoryRaw.length > 0
      ? subcategoryRaw
      : undefined

  // Read server-only secrets at request time.
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

  const fileName = (file instanceof File && file.name) || 'upload'
  const mimeType = file.type || 'application/octet-stream'
  const body = Readable.from(Buffer.from(await file.arrayBuffer()))

  try {
    const result = await client.upload(
      driveModule,
      subcategory,
      { body, mimeType, name: fileName },
      { name: fileName, mimeType },
    )
    return NextResponse.json(result, { status: 201 })
  } catch {
    // Drive 403 (quota / revoked) and other failures surface as a friendly error (§5.6).
    return NextResponse.json(
      { error: 'Drive upload failed', code: 'DRIVE_UPLOAD_FAILED' },
      { status: 502 },
    )
  }
}
