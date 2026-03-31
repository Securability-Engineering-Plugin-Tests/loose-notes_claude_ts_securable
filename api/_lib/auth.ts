// JWT authentication helpers — Authenticity (S3.2.2)
// Uses jose for standards-compliant JWT creation and verification.
// Tokens travel in httpOnly cookies to mitigate XSS token theft.

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthContext, JwtPayload } from './types.js';

const JWT_SECRET_ENV = process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production-32ch';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
const IS_PROD = process.env.NODE_ENV === 'production';

// Encode the secret as a Uint8Array once (jose requirement)
const secretKey = new TextEncoder().encode(JWT_SECRET_ENV);

/** Create a signed JWT for the given user context. */
export async function signToken(ctx: Omit<AuthContext, never>): Promise<string> {
  return new SignJWT({ username: ctx.username, role: ctx.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ctx.userId)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secretKey);
}

/** Verify and decode a JWT. Returns null on any failure — never throws to caller. */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as JwtPayload;
  } catch {
    // All JWT errors (expired, tampered, wrong alg) produce null — no detail leaked
    return null;
  }
}

/** Extract the JWT from the Authorization header or the auth_token cookie. */
export function extractToken(req: VercelRequest): string | null {
  // 1. Try Authorization header (Bearer scheme)
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 2. Try httpOnly cookie
  const cookieHeader = req.headers.cookie ?? '';
  const match = /(?:^|;\s*)auth_token=([^;]+)/.exec(cookieHeader);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Set the auth cookie on the response (httpOnly, Secure in prod). */
export function setAuthCookie(res: VercelResponse, token: string): void {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  const flags = [
    `HttpOnly`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `SameSite=Strict`,
    IS_PROD ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', `auth_token=${encodeURIComponent(token)}; ${flags}`);
}

/** Clear the auth cookie. */
export function clearAuthCookie(res: VercelResponse): void {
  res.setHeader(
    'Set-Cookie',
    'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
  );
}

/** Require authentication — resolves to AuthContext or sends 401 and returns null. */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthContext | null> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    res.status(401).json({ ok: false, error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' } });
    return null;
  }

  return { userId: payload.sub, username: payload.username, role: payload.role };
}

/** Require admin role — sends 403 if user is not admin. */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthContext | null> {
  const ctx = await requireAuth(req, res);
  if (!ctx) return null;

  if (ctx.role !== 'admin') {
    res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    return null;
  }

  return ctx;
}
