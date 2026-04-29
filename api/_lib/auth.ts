/**
 * Auth boundary helpers — authentication and authorization gates.
 *
 * FIASSE: every state-changing handler runs through `requireUser` (or the
 * stronger `requireAdmin` / `requireOwner` variants). Authorization is
 * derived from the SIGNED session, never from a request parameter or
 * separate cookie (S4.4.1.2 Derived Integrity, in direct contrast to the
 * PRD §16 specification of a separate user-id cookie).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AppError } from './errors.js';
import { readSession, type SessionClaims } from './session.js';
import { config } from './config.js';
import { findUserById, type Role, type UserRecord } from './db.js';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  username: string;
  email: string;
}

export async function getAuthenticatedUser(req: VercelRequest): Promise<AuthenticatedUser | null> {
  const claims = await readSession(req);
  if (!claims) return null;
  // Re-load the user record so role changes/account deletion take effect
  // immediately on the next request — we do not blindly trust the JWT
  // payload for authorization-affecting fields.
  const user = findUserById(claims.sub);
  if (!user) return null;
  return { id: user.id, role: user.role, username: user.username, email: user.email };
}

export async function requireUser(req: VercelRequest): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(req);
  if (!user) throw new AppError('unauthenticated', 'Authentication required');
  return user;
}

export async function requireAdmin(req: VercelRequest): Promise<AuthenticatedUser> {
  const user = await requireUser(req);
  if (user.role !== 'admin') {
    throw new AppError('forbidden', 'Administrator privileges required');
  }
  return user;
}

/**
 * Method gate — explicit allow-list. The PRD §18.2 "Verb-specific authorization
 * rules ... shall enumerate only GET and POST explicitly. No deny rule shall
 * be defined for other HTTP methods." pattern is REJECTED. Here we deny by
 * default and accept only the listed methods. (S4.3 Boundary Control)
 */
export function requireMethod(req: VercelRequest, res: VercelResponse, allowed: readonly string[]): string {
  const method = (req.method ?? 'GET').toUpperCase();
  if (!allowed.includes(method)) {
    res.setHeader('Allow', allowed.join(', '));
    throw new AppError('method_not_allowed', `Method ${method} not allowed`);
  }
  return method;
}

/**
 * Origin / Referer check for state-changing requests. Even with SameSite=Strict
 * cookies, this defense-in-depth check rejects cross-origin form posts that
 * may slip past via subdomains, browser quirks, or non-cookie auth flows.
 */
export function enforceOrigin(req: VercelRequest): void {
  const origin = (req.headers.origin ?? req.headers.referer ?? '').toString();
  if (!origin) {
    // Same-origin GET-style fetches with credentials may omit Origin in some
    // browsers; we already require SameSite=Strict. Accept absent Origin for
    // that case but require it on safer state-changing paths via callers
    // that explicitly want strictness (most do).
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new AppError('forbidden', 'Invalid origin');
  }
  const candidate = `${parsed.protocol}//${parsed.host}`;
  if (!config.allowedOrigins.includes(candidate)) {
    throw new AppError('forbidden', 'Origin not allowed');
  }
}

/** Strict origin enforcement — Origin/Referer MUST be present and allowed. */
export function requireAllowedOrigin(req: VercelRequest): void {
  const origin = (req.headers.origin ?? req.headers.referer ?? '').toString();
  if (!origin) throw new AppError('forbidden', 'Origin header required');
  enforceOrigin(req);
}

export function isOwnerOrAdmin(actor: { id: string; role: Role }, ownerId: string): boolean {
  return actor.id === ownerId || actor.role === 'admin';
}

export function publicUserView(user: UserRecord): {
  id: string; username: string; email: string; role: Role; createdAt: string;
} {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/**
 * Read the session claims without loading the full user. Used by lightweight
 * paths that only need to know "is there a session" without the DB roundtrip.
 */
export async function getSessionClaims(req: VercelRequest): Promise<SessionClaims | null> {
  return readSession(req);
}
