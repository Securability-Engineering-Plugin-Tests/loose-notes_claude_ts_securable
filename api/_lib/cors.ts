// CORS and common security headers — Availability + Integrity
// Applied to every API response to enforce origin policy.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173';
const ALLOWED_ORIGINS = new Set(ALLOWED_ORIGINS_ENV.split(',').map((o) => o.trim()));

/** Apply CORS headers and handle preflight OPTIONS requests.
 *  Returns true if caller should stop (preflight handled). */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin ?? '';

  // Reflect origin only if it is in the allowlist — never use wildcard with credentials
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-CSRF-Token'
  );

  // Handle preflight — short-circuit
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

/** Apply security headers to every API response. */
export function applySecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/** Simple in-memory rate limiter for auth endpoints (Availability). */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // allowed
  }

  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}
