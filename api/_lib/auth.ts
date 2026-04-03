/**
 * JWT-based authentication middleware for Vercel API routes.
 *
 * SSEM: Authenticity, Accountability — tokens are signed with a strong secret,
 * stored in httpOnly cookies, and each session is server-verifiable.
 *
 * PRD anti-patterns corrected:
 * - §2.2: Insecure cookie config → httpOnly + Secure + SameSite=Strict
 * - §16.2: Cookie value passed directly to DB → JWT claims validated server-side
 * - §18.2: Admin area reachable without role check → role enforced here
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from './logger.js';
import { generateCsrfToken, timingSafeEqual } from './crypto.js';

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
const JWT_ALGORITHM = 'HS256';
const SESSION_DURATION = '4h'; // Short-lived; refresh on activity if needed

export interface SessionClaims extends JWTPayload {
  sub: string;       // userId
  username: string;
  role: 'user' | 'admin';
}

/**
 * Issue a signed JWT and write it to an httpOnly, Secure, SameSite=Strict cookie.
 * Returns the CSRF token to be delivered in the JSON response body.
 */
export async function issueSession(
  res: VercelResponse,
  userId: string,
  username: string,
  role: 'user' | 'admin',
): Promise<string> {
  const token = await new SignJWT({ username, role } satisfies Omit<SessionClaims, keyof JWTPayload>)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(JWT_SECRET);

  const csrfToken = generateCsrfToken();
  const isProduction = process.env.NODE_ENV === 'production';

  // HttpOnly prevents JS access; Secure ensures HTTPS-only transmission;
  // SameSite=Strict prevents cross-origin request forgery.
  const cookieFlags = [
    `session=${token}`,
    'HttpOnly',
    isProduction ? 'Secure' : '',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${4 * 60 * 60}`,
  ].filter(Boolean).join('; ');

  // CSRF token in a non-HttpOnly cookie so JS can read it for the double-submit pattern
  const csrfFlags = [
    `csrf=${csrfToken}`,
    isProduction ? 'Secure' : '',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${4 * 60 * 60}`,
  ].filter(Boolean).join('; ');

  res.setHeader('Set-Cookie', [cookieFlags, csrfFlags]);
  return csrfToken;
}

/** Clear both session and CSRF cookies on logout. */
export function clearSession(res: VercelResponse): void {
  res.setHeader('Set-Cookie', [
    'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    'csrf=; SameSite=Strict; Path=/; Max-Age=0',
  ]);
}

/** Parse and verify the session JWT from the request cookie. */
export async function verifySession(req: VercelRequest): Promise<SessionClaims | null> {
  const cookieHeader = req.headers.cookie ?? '';
  const sessionCookie = parseCookieValue(cookieHeader, 'session');
  if (!sessionCookie) return null;

  try {
    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

/**
 * Validate CSRF double-submit: cookie value must match X-CSRF-Token header.
 * Applied on all state-changing requests (POST, PUT, DELETE, PATCH).
 */
export function verifyCsrf(req: VercelRequest): boolean {
  const cookieHeader = req.headers.cookie ?? '';
  const cookieCsrf = parseCookieValue(cookieHeader, 'csrf');
  const headerCsrf = req.headers['x-csrf-token'];

  if (!cookieCsrf || !headerCsrf || typeof headerCsrf !== 'string') return false;
  return timingSafeEqual(cookieCsrf, headerCsrf);
}

function parseCookieValue(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

// ── Middleware helpers ────────────────────────────────────────────────────────

/** Require authenticated session; returns claims or sends 401. */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<SessionClaims | null> {
  const claims = await verifySession(req);
  if (!claims) {
    logger.warn('auth.required.failed', { path: req.url });
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return null;
  }
  return claims;
}

/** Require admin role; returns claims or sends 403. */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<SessionClaims | null> {
  const claims = await requireAuth(req, res);
  if (!claims) return null;
  if (claims.role !== 'admin') {
    logger.audit('authz.admin.denied', {
      action: 'admin_access',
      userId: claims.sub,
      resource: req.url,
      outcome: 'failure',
    });
    res.status(403).json({ code: 'FORBIDDEN', message: 'Administrator access required' });
    return null;
  }
  return claims;
}

/** Validate CSRF on mutating methods; sends 403 if invalid. */
export function requireCsrf(req: VercelRequest, res: VercelResponse): boolean {
  const mutating = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!mutating.includes(req.method ?? '')) return true;
  if (!verifyCsrf(req)) {
    logger.warn('csrf.validation.failed', { path: req.url, method: req.method });
    res.status(403).json({ code: 'CSRF_INVALID', message: 'Invalid or missing CSRF token' });
    return false;
  }
  return true;
}
