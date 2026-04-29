/**
 * Session management — short-lived signed JWT in a hardened cookie.
 *
 * FIASSE rejections from the PRD:
 *  - §2.2: PRD specifies a 14-day cookie with no HttpOnly/Secure/SameSite.
 *    REJECTED. Sessions are 1-hour signed JWTs delivered in a cookie that
 *    is HttpOnly, Secure, SameSite=Strict, Path=/, with explicit Max-Age.
 *  - §16.2: PRD specifies reading the user-id from a cookie and trusting it
 *    as the profile-target identifier without verifying authentication.
 *    REJECTED. The session cookie is signed; the user-id is derived from
 *    the verified payload, never read from a separate client-controlled
 *    cookie. (S4.4.1.2 Derived Integrity)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, jwtVerify } from 'jose';
import { config } from './config.js';
import { logger } from './logger.js';
import type { Role } from './db.js';

// We use the __Host- prefix only when the cookie is also Secure (browsers
// reject __Host- cookies served over plain HTTP). For local HTTP development
// we fall back to a plain name.
const COOKIE_NAME_SECURE = '__Host-ln_session';
const COOKIE_NAME_INSECURE = 'ln_session';
const ISSUER = 'loosenotes';
const AUDIENCE = 'loosenotes-api';

function activeCookieName(): string {
  return config.cookieSecure ? COOKIE_NAME_SECURE : COOKIE_NAME_INSECURE;
}

export interface SessionClaims {
  sub: string;       // user id
  role: Role;
  username: string;
  // Standard JWT claims set by jose: iat, exp, iss, aud
}

export async function issueSession(res: VercelResponse, claims: SessionClaims): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + config.limits.sessionTtlSeconds;
  const jwt = await new SignJWT({ role: claims.role, username: claims.username })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(config.sessionSecret);
  setSessionCookie(res, jwt, config.limits.sessionTtlSeconds);
}

export async function readSession(req: VercelRequest): Promise<SessionClaims | null> {
  const cookieHeader = req.headers.cookie ?? '';
  // Try the active name first; fall back to the other name so a deployment
  // toggling COOKIE_SECURE does not invalidate in-flight sessions.
  const token = parseCookieValue(cookieHeader, activeCookieName())
    ?? parseCookieValue(cookieHeader, COOKIE_NAME_SECURE)
    ?? parseCookieValue(cookieHeader, COOKIE_NAME_INSECURE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, config.sessionSecret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string') return null;
    const role = payload.role;
    const username = payload.username;
    if (role !== 'user' && role !== 'admin') return null;
    if (typeof username !== 'string') return null;
    return { sub: payload.sub, role, username };
  } catch (err) {
    logger.debug('session.verify.failed', { reason: err instanceof Error ? err.message : 'unknown' });
    return null;
  }
}

export function clearSession(res: VercelResponse): void {
  setSessionCookie(res, '', 0);
}

function setSessionCookie(res: VercelResponse, value: string, maxAgeSeconds: number): void {
  // __Host- prefix mandates Secure, Path=/, no Domain attribute. We require
  // Secure always except when COOKIE_SECURE=false is explicitly set for local
  // HTTP development. In that case we also drop the __Host- prefix because
  // browsers reject it without Secure.
  const name = activeCookieName();
  const attrs = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (config.cookieSecure) attrs.push('Secure');
  appendSetCookie(res, attrs.join('; '));
}

function appendSetCookie(res: VercelResponse, value: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, value]);
  } else if (typeof existing === 'string') {
    res.setHeader('Set-Cookie', [existing, value]);
  } else {
    res.setHeader('Set-Cookie', value);
  }
}

/**
 * Parse a single cookie value from a Cookie header.
 *
 * Boundary defensiveness (S4.3, S4.4.1):
 *  - Cookie names are case-sensitive per RFC 6265, so we compare exactly.
 *  - Values may contain trailing whitespace from upstream proxies; trim.
 *  - Multiple cookies with the same name: take the first (matches browser
 *    sending behavior). Multiple Cookie headers are joined by Node into one
 *    string already, separated by `; `.
 */
function parseCookieValue(header: string, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) {
      return part.slice(eq + 1).trim();
    }
  }
  return null;
}
