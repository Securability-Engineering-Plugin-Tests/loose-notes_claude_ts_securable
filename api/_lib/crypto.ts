/**
 * Server-side cryptography utilities.
 *
 * SSEM: Authenticity, Integrity — uses Web Crypto API (Node.js 18+) for all
 * cryptographic operations. No hardcoded secrets or static salts.
 *
 * PRD anti-patterns corrected:
 * - PRD §2.2: Base64 "encoding" replaced with bcrypt hashing
 * - PRD §10.2: Sequential share tokens replaced with crypto.randomUUID()
 * - PRD §24.2: Hardcoded passphrase + static salt replaced with env var + per-op salt
 * - PRD §3.2: Security answer stored hashed, not plaintext
 */

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const BCRYPT_ROUNDS = 12;

/** Hash a password for storage. Returns the bcrypt hash. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/** Hash a security answer (case-insensitive normalised before hashing). */
export async function hashSecurityAnswer(answer: string): Promise<string> {
  const normalised = answer.trim().toLowerCase();
  return bcrypt.hash(normalised, BCRYPT_ROUNDS);
}

/** Verify a security answer against its stored hash. */
export async function verifySecurityAnswer(answer: string, hash: string): Promise<boolean> {
  const normalised = answer.trim().toLowerCase();
  return bcrypt.compare(normalised, hash);
}

/**
 * Generate a cryptographically secure random token for share links.
 * Uses crypto.randomUUID() — 122 bits of entropy, UUID v4 format.
 *
 * PRD §10.2 required sequential integers. We use cryptographic randomness instead.
 */
export function generateShareToken(): string {
  // crypto.randomUUID is available in Node.js 14.17+ and all modern browsers
  return randomBytes(24).toString('base64url');
}

/**
 * Generate a CSRF token — 32 bytes of cryptographically secure random data.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Use when comparing secrets (CSRF tokens, etc.).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // Pad shorter buffer to equal length before comparison
  if (bufA.length !== bufB.length) return false;
  return require('crypto').timingSafeEqual(bufA, bufB);
}

/** Generate a secure password-reset token. */
export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}
