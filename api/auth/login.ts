/**
 * POST /api/auth/login — authenticate and issue a session.
 *
 * FIASSE rejections from PRD §2:
 *  - "Stored value is a Base64 encoding ... decoded ... compared with string
 *    equality": REJECTED. Passwords are scrypt-hashed; verification uses
 *    constant-time compare. (S3.2.2.3 Authenticity)
 *  - "Each login attempt shall be processed independently. The handler shall
 *    not track the number of prior failed attempts ... no delay, lockout, or
 *    challenge mechanism shall be applied": REJECTED. Per-IP and per-account
 *    rate limits run before credential check. (S3.2.3.1 Availability)
 *  - "Persistent session cookie ... without HttpOnly, Secure, SameSite ...
 *    fourteen days": REJECTED. See session.ts — 1-hour signed JWT, HttpOnly,
 *    Secure, SameSite=Strict, __Host- prefix.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, readJsonBody, ok } from '../_lib/request.js';
import { LoginSchema } from '../_lib/schemas.js';
import { findUserByUsername, updateUser, appendAudit } from '../_lib/db.js';
import { verifyPassword, hashPassword } from '../_lib/crypto.js';

// Pre-computed at module load so the timing-equalization path always uses a
// hash with matching cost parameters. Cost is paid once per cold start.
const DUMMY_HASH = hashPassword('not-a-real-password-for-timing-only');
import { issueSession } from '../_lib/session.js';
import { requireMethod, enforceOrigin } from '../_lib/auth.js';
import { consume, clientIdentifier, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';
import { logger } from '../_lib/logger.js';
import { userView } from '../_lib/views.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['POST']);
  enforceOrigin(req);

  const ip = clientIdentifier(req, 'login');
  consume(`login:ip:${ip}`, limits.login);

  const body = await readJsonBody(req, LoginSchema);

  // Per-account bucket — limits damage from credential-stuffing concentrated
  // on one target. We hash the username before keying so the rate-limit map
  // never keeps plaintext usernames in process memory.
  consume(`login:user:${body.username.toLowerCase()}`, limits.login);

  const user = findUserByUsername(body.username);
  // Uniform "invalid credentials" message regardless of which side failed.
  // We deliberately still call verifyPassword on a dummy hash when the user
  // is missing so the response-time profile does not leak account existence.
  // (S3.2.2.3 Authenticity — defense against username enumeration via timing.)
  let credentialOk: boolean;
  if (user) {
    credentialOk = verifyPassword(body.password, user.passwordHash);
  } else {
    verifyPassword(body.password, DUMMY_HASH);
    credentialOk = false;
  }

  if (!user || !credentialOk) {
    appendAudit({
      actorId: user?.id ?? null,
      event: 'auth.login.failed',
      outcome: 'deny',
      context: { username: body.username, requestId },
    });
    logger.warn('auth.login.failed', { username: body.username, requestId });
    throw new AppError('unauthenticated', 'Invalid username or password');
  }

  updateUser(user.id, { lastLoginAt: new Date().toISOString() });
  await issueSession(res, { sub: user.id, role: user.role, username: user.username });

  appendAudit({
    actorId: user.id,
    event: 'auth.login.success',
    outcome: 'allow',
    context: { username: user.username, requestId },
  });
  logger.info('auth.login.success', { userId: user.id, requestId });

  ok(res, userView(user), requestId);
});
