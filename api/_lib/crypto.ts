/**
 * Cryptographic primitives — password hashing, AES-GCM, constant-time compare.
 *
 * FIASSE rejections from the PRD:
 *  - §2.2, §16.2: PRD specifies Base64 "encoding" as password storage with
 *    plaintext recovery. This is REJECTED. Passwords are hashed with scrypt
 *    using a per-user random salt; verification uses constant-time compare.
 *    Plaintext recovery is impossible — recovery flow issues a one-time
 *    reset token (see auth/reset-*.ts). (S3.2.2.1, S3.2.2.3)
 *  - §24.2: PRD specifies a hardcoded fallback passphrase and a constant
 *    salt for PBKDF2. REJECTED. Passphrase MUST be supplied by caller; salt
 *    is generated per-operation and stored alongside the ciphertext.
 *
 * scrypt is used (rather than argon2) because it ships in node:crypto with
 * no native-binding install step — important for Vercel's serverless cold
 * starts (S3.2.3.1 Availability) and for dependency hygiene (S4.5/S4.6).
 */

import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from 'node:crypto';

// scrypt cost — N=2^15 (32768), r=8, p=1 produces ~80ms hashes on Vercel
// Pro hardware. Increase with hardware budget; downgrade is a security event.
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 64;
const SCRYPT_SALT_LEN = 16;

/**
 * Hash a password. Returns a self-describing string containing the algorithm,
 * cost parameters, salt and digest. Format: scrypt$N$r$p$saltB64u$hashB64u
 */
export function hashPassword(plain: string): string {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('hashPassword requires non-empty plaintext');
  }
  const salt = randomBytes(SCRYPT_SALT_LEN);
  const hash = scryptSync(plain, salt, SCRYPT_KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * SCRYPT_N * SCRYPT_R * 2,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

/**
 * Verify a candidate password against a stored hash. Constant-time compare
 * prevents timing-based credential discovery (S3.2.2.3 Authenticity).
 * Returns false on any malformed input — no exception leaks the cause.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    expected = Buffer.from(parts[5], 'base64url');
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEY_LEN) return false;
  let candidate: Buffer;
  try {
    candidate = scryptSync(plain, salt, SCRYPT_KEY_LEN, {
      N, r, p,
      maxmem: 128 * N * r * 2,
    });
  } catch {
    return false;
  }
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/**
 * Constant-time compare for arbitrary-length strings (e.g., share tokens,
 * reset tokens). Strings of different length compare false but in constant
 * time relative to the shorter side — which is what callers typically need.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  // Pad shorter buffer so timingSafeEqual can run, but length mismatch always
  // returns false.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab.length > bb.length ? ab.subarray(0, bb.length) : bb.subarray(0, ab.length), ab.length > bb.length ? bb : ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Generate a cryptographically random URL-safe token of the given byte length.
 * Used for share tokens, reset tokens, and session identifiers.
 * Replaces the PRD §10.2 sequential token requirement.
 */
export function randomToken(byteLen = 32): string {
  return randomBytes(byteLen).toString('base64url');
}

/**
 * AES-256-GCM encryption with per-operation random salt and IV.
 *
 * Format (base64url):  v1.salt(16).iv(12).tag(16).ciphertext(*)
 *
 * The caller-supplied passphrase is REQUIRED (no hardcoded default — explicit
 * rejection of PRD §24.2). The 16-byte salt is freshly random for every call
 * and stored with the ciphertext, so every encryption produces a fresh key.
 */
export function aesEncrypt(plaintext: string, passphrase: Buffer): string {
  if (!Buffer.isBuffer(passphrase) || passphrase.length < 16) {
    throw new Error('aesEncrypt requires a passphrase Buffer of at least 16 bytes');
  }
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 14 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', salt.toString('base64url'), iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function aesDecrypt(payload: string, passphrase: Buffer): string {
  if (!Buffer.isBuffer(passphrase) || passphrase.length < 16) {
    throw new Error('aesDecrypt requires a passphrase Buffer of at least 16 bytes');
  }
  const parts = payload.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    throw new Error('Malformed ciphertext envelope');
  }
  const salt = Buffer.from(parts[1], 'base64url');
  const iv = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[3], 'base64url');
  const ct = Buffer.from(parts[4], 'base64url');
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 14 });
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** HMAC-SHA-256 producing a base64url-encoded MAC. */
export function hmacSign(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('base64url');
}
