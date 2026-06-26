import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from '@/lib/drive/crypto'

// Fixed 32-byte (64 hex char) test key. NOT a real key.
const KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const OTHER_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'

describe('drive/crypto — AES-256-GCM token encryption', () => {
  it('round-trips a refresh token (encrypt → decrypt)', () => {
    const secret = '1//0gFakeRefreshToken-abcDEF_123456789'
    const packed = encryptToken(secret, KEY)
    expect(Buffer.isBuffer(packed)).toBe(true)
    expect(decryptToken(packed, KEY)).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const secret = 'same-plaintext'
    const a = encryptToken(secret, KEY)
    const b = encryptToken(secret, KEY)
    expect(a.equals(b)).toBe(false)
    // ...but both decrypt back to the same plaintext.
    expect(decryptToken(a, KEY)).toBe(secret)
    expect(decryptToken(b, KEY)).toBe(secret)
  })

  it('packs as IV(12) || authTag(16) || ciphertext', () => {
    const packed = encryptToken('x', KEY)
    // 12 + 16 + at least 1 byte of ciphertext.
    expect(packed.length).toBeGreaterThanOrEqual(12 + 16 + 1)
  })

  it('round-trips through a hex string representation', () => {
    const secret = 'hex-roundtrip'
    const packed = encryptToken(secret, KEY)
    expect(decryptToken(packed.toString('hex'), KEY)).toBe(secret)
  })

  it('fails to decrypt with the wrong key', () => {
    const packed = encryptToken('top-secret', KEY)
    expect(() => decryptToken(packed, OTHER_KEY)).toThrow()
  })

  it('fails the auth tag when the ciphertext is tampered with', () => {
    const packed = encryptToken('top-secret', KEY)
    // Flip a bit in the ciphertext region (past IV + authTag).
    const tampered = Buffer.from(packed)
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0x01
    expect(() => decryptToken(tampered, KEY)).toThrow()
  })

  it('fails the auth tag when the auth tag is tampered with', () => {
    const packed = encryptToken('top-secret', KEY)
    const tampered = Buffer.from(packed)
    tampered[12] = tampered[12]! ^ 0x01 // first byte of the auth tag
    expect(() => decryptToken(tampered, KEY)).toThrow()
  })

  it('rejects a malformed key', () => {
    expect(() => encryptToken('x', 'too-short')).toThrow(/64-character hex/)
    expect(() => decryptToken(encryptToken('x', KEY), 'nothex'.repeat(11))).toThrow()
  })

  it('rejects truncated ciphertext', () => {
    const packed = encryptToken('x', KEY)
    expect(() => decryptToken(packed.subarray(0, 10), KEY)).toThrow(/too short/)
  })
})
