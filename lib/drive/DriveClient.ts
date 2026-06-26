import { Readable } from 'stream'
import { google, type drive_v3 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type DriveModule,
  type FolderCreator,
  modulePath,
  resolveFolderId,
} from './folders'

/**
 * Per-request Google Drive adapter (spec §5.1, §5.3).
 *
 * Instantiated from the household owner's *decrypted* refresh token plus the
 * OAuth client id/secret (from env, decrypted/read only server-side). Access
 * tokens (1-hour TTL) are fetched on demand by the OAuth2 client and held in
 * memory only — never persisted, never sent to the browser (§5.2).
 *
 * All Drive folder creation funnels through this client (it implements
 * {@link FolderCreator}), and folder ids are cached in `drive_folders` via the
 * resolver so repeated uploads don't re-walk the tree.
 *
 * Live Google Drive calls are NOT exercised in tests (no real OAuth token in CI);
 * verification of the live API surface is deferred to manual testing once the
 * OAuth connect flow exists. See the module summary returned by the build task.
 */

export interface DriveUploadResult {
  driveFileId: string
  webViewLink: string | null
  thumbnailLink: string | null
}

export interface DriveListedFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  thumbnailLink: string | null
  modifiedTime: string | null
}

/** Subset of the upload metadata callers may supply. */
export interface DriveUploadMetadata {
  /** File name to store in Drive. Falls back to a generic name if omitted. */
  name?: string
  /** MIME type; defaults to application/octet-stream. */
  mimeType?: string
}

/** Input file: a Buffer/stream plus its inferred mime type. */
export interface DriveUploadFile {
  body: Buffer | Readable
  mimeType?: string
  name?: string
}

export interface DriveClientConfig {
  refreshToken: string
  clientId: string
  clientSecret: string
  /** Supabase client used for the `drive_folders` cache (RLS-scoped or service). */
  supabase: SupabaseClient
  householdId: string
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

// Use the OAuth2 client type from the `googleapis` bundle itself — importing
// `google-auth-library` directly pulls in a second, structurally-incompatible copy.
type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>

export class DriveClient implements FolderCreator {
  private readonly auth: GoogleOAuth2Client
  private readonly drive: drive_v3.Drive
  private readonly supabase: SupabaseClient
  private readonly householdId: string

  constructor(config: DriveClientConfig) {
    this.auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
    this.auth.setCredentials({ refresh_token: config.refreshToken })
    // googleapis auto-refreshes the access token in memory using the refresh token.
    this.drive = google.drive({ version: 'v3', auth: this.auth })
    this.supabase = config.supabase
    this.householdId = config.householdId
  }

  /**
   * FolderCreator: ensure a folder named `name` exists under `parentId`
   * (root if undefined). Looks for an existing non-trashed folder first to keep
   * lazy creation idempotent, then creates one if absent.
   */
  async ensureFolder(name: string, parentId?: string): Promise<string> {
    const parentClause = parentId
      ? `'${parentId}' in parents`
      : `'root' in parents`
    const q = [
      `mimeType = '${FOLDER_MIME}'`,
      `name = '${name.replace(/'/g, "\\'")}'`,
      parentClause,
      'trashed = false',
    ].join(' and ')

    const existing = await this.drive.files.list({
      q,
      fields: 'files(id)',
      pageSize: 1,
      spaces: 'drive',
    })
    const found = existing.data.files?.[0]?.id
    if (found) return found

    const created = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: FOLDER_MIME,
        parents: parentId ? [parentId] : undefined,
      },
      fields: 'id',
    })
    const id = created.data.id
    if (!id) throw new Error(`Drive failed to create folder "${name}"`)
    return id
  }

  /** Resolve (and lazily create) the Drive folder for a module/subcategory path. */
  private async resolveTarget(
    module: DriveModule,
    subcategory?: string,
  ): Promise<string> {
    const path = subcategory
      ? `${modulePath(module)}/${subcategory}`
      : modulePath(module)
    const id = await resolveFolderId(this.supabase, this.householdId, path, this)
    if (!id) throw new Error(`Could not resolve Drive folder for ${path}`)
    return id
  }

  /** Upload a file into `<module>/<subcategory>`, returning Drive ids/links (§5.3). */
  async upload(
    module: DriveModule,
    subcategory: string | undefined,
    file: DriveUploadFile,
    metadata: DriveUploadMetadata = {},
  ): Promise<DriveUploadResult> {
    const parentId = await this.resolveTarget(module, subcategory)
    const res = await this.drive.files.create({
      requestBody: {
        name: metadata.name ?? file.name ?? 'upload',
        parents: [parentId],
      },
      media: {
        mimeType: metadata.mimeType ?? file.mimeType ?? 'application/octet-stream',
        body: file.body instanceof Readable ? file.body : Readable.from(file.body),
      },
      fields: 'id, webViewLink, thumbnailLink',
    })
    const id = res.data.id
    if (!id) throw new Error('Drive upload returned no file id')
    return {
      driveFileId: id,
      webViewLink: res.data.webViewLink ?? null,
      thumbnailLink: res.data.thumbnailLink ?? null,
    }
  }

  /** Stream a file's bytes back (§5.3). */
  async download(driveFileId: string): Promise<Readable> {
    const res = await this.drive.files.get(
      { fileId: driveFileId, alt: 'media' },
      { responseType: 'stream' },
    )
    return res.data as unknown as Readable
  }

  /** Permanently delete a file (§5.3). */
  async delete(driveFileId: string): Promise<void> {
    await this.drive.files.delete({ fileId: driveFileId })
  }

  /** List non-trashed files in `<module>/<subcategory>` (§5.3). */
  async list(
    module: DriveModule,
    subcategory?: string,
  ): Promise<DriveListedFile[]> {
    const parentId = await this.resolveTarget(module, subcategory)
    const res = await this.drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields:
        'files(id, name, mimeType, webViewLink, thumbnailLink, modifiedTime)',
      spaces: 'drive',
    })
    return (res.data.files ?? []).map((f) => ({
      id: f.id ?? '',
      name: f.name ?? '',
      mimeType: f.mimeType ?? '',
      webViewLink: f.webViewLink ?? null,
      thumbnailLink: f.thumbnailLink ?? null,
      modifiedTime: f.modifiedTime ?? null,
    }))
  }

  /**
   * Return a Drive thumbnail URL for a file at the requested pixel size (§5.3).
   * Drive's `thumbnailLink` carries an `=s220` sizing suffix that can be rewritten
   * to the requested size. Returns null when the file has no thumbnail.
   */
  async getThumbnail(driveFileId: string, size: number): Promise<string | null> {
    const res = await this.drive.files.get({
      fileId: driveFileId,
      fields: 'thumbnailLink',
    })
    const link = res.data.thumbnailLink
    if (!link) return null
    return link.replace(/=s\d+$/, `=s${size}`)
  }
}
