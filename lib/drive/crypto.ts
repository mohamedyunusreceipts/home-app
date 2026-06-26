import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * AES-256-GCM encryption for the household's Google Drive refresh token (spec §5.2).
 *
 * The token is decrypted only server-side (route handlers / DriveClient) and is
 * never returned to the browser. The encryption key is a 32-byte value supplied as
 * a 64-character hex string via the `DRIVE_TOKEN_ENCRYPTION_KEY` env var at runtime.
 * These functions take the key as a parameter so they are unit-testable in isolation.
 *
 * Packed format (stored in `households.drive_refresh_token_encrypted bytea`):
 *
 *   ┌────────────┬──────────────┬───────────────────┐
 *   │ IV (12 B)  │ authTag (16) │ ciphertext (N B)  │
 *   └────────────┴──────────────┴───────────────────┘
 *
 * A random 12-byte IV is generated per encryption (GCM's recommended nonce size).
 * The 16-byte GCM auth tag follows, then the ciphertext. The whole thing is one
 * Buffer; decryption slices it back apart. Any tampering (wrong key, flipped bits,
 * truncated data) fails the GCM auth-tag check and throws.
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

/** Parse + validate a 64-hex-char (32-byte) key. Throws on malformed keys. */
function parseKey(keyHex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'DRIVE_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    )
  }
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== KEY_BYTES) {
    throw new Error('Drive token encryption key must decode to exactly 32 bytes')
  }
  return key
}

/**
 * Encrypt a refresh token. Returns a packed Buffer of `IV || authTag || ciphertext`
 * suitable for storing directly into a Postgres `bytea` column.
 */
export function encryptToken(plaintext: string, keyHex: string): Buffer {
  const key = parseKey(keyHex)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
}

/**
 * Decrypt a packed Buffer (or hex/base64 string) produced by `encryptToken`.
 * Throws if the key is wrong, the data is truncated, or the auth tag fails.
 */
export function decryptToken(
  packed: Buffer | Uint8Array | string,
  keyHex: string,
): string {
  const key = parseKey(keyHex)
  const buf =
    typeof packed === 'string'
      ? Buffer.from(packed, /^[0-9a-fA-F]+$/.test(packed) ? 'hex' : 'base64')
      : Buffer.from(packed)

  if (buf.length < IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error('Encrypted token is too short to be valid')
  }

  const iv = buf.subarray(0, IV_BYTES)
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + AUTH_TAG_BYTES)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  // .final() throws if the auth tag does not verify (tampering / wrong key).
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  )
}
