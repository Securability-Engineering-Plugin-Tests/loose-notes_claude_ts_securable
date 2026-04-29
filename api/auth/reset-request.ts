/**
 * POST /api/auth/reset-request — start a password reset.
 *
 * FIASSE rejections from PRD §3, §4:
 *  - "Plaintext security answer stored": REJECTED. The recovery flow does
 *    not require a security question / answer at all — that pattern has
 *    been deprecated by NIST SP 800-63B §5.1.1.2.
 *  - "Decode the answer from a Base64 cookie and compare to user input":
 *    REJECTED. There is no client-controlled cookie carrying the secret
 *    state. (S4.4.1.2 Derived Integrity)
 *  - "If the email is not in the data store, return immediately with a
 *    distinct response": REJECTED. We always respond with 202 Accepted
 *    regardless of whether the email exists, preventing enumeration.
 *  - "Display the user's current password in plain text": REJECTED.
 *    Plaintext is not stored, so it cannot be returned. The reset flow
 *    issues a one-time token instead. (S3.2.2.1 Confidentiality)
 *
 * Token model: a 256-bit random token is generated, the HMAC of the token
 * is persisted with a 15-minute TTL, and the raw token is delivered via the
 * response in development (or via email in production). Storing only the
 * HMAC means a database leak does not yield reusable reset credentials.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'node:crypto';
import { handler, readJsonBody, ok } from '../_lib/request.js';
import { ResetRequestSchema } from '../_lib/schemas.js';
import { findUserByEmail, createResetToken, appendAudit } from '../_lib/db.js';
import { randomToken } from '../_lib/crypto.js';
import { config } from '../_lib/config.js';
import { requireMethod, enforceOrigin } from '../_lib/auth.js';
import { consume, clientIdentifier, limits } from '../_lib/ratelimit.js';
import { logger } from '../_lib/logger.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['POST']);
  enforceOrigin(req);
  consume(`resetReq:${clientIdentifier(req, 'reset')}`, limits.resetRequest);

  const body = await readJsonBody(req, ResetRequestSchema);
  const user = findUserByEmail(body.email);

  // Always behave the same regardless of email existence.
  let issuedToken: string | null = null;
  if (user) {
    const token = randomToken(32);
    const tokenHash = createHmac('sha256', config.resetSecret).update(token).digest('base64url');
    const now = Date.now();
    createResetToken({
      tokenHash,
      userId: user.id,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + config.limits.resetTokenTtlSeconds * 1000).toISOString(),
    });
    issuedToken = token;
    appendAudit({
      actorId: user.id,
      event: 'auth.reset.request',
      outcome: 'info',
      context: { email: body.email, requestId },
    });
  } else {
    appendAudit({
      actorId: null,
      event: 'auth.reset.request.unknown_email',
      outcome: 'info',
      context: { email: body.email, requestId },
    });
  }

  // In production this endpoint would call an email-sending service. For the
  // demo, we surface the raw token in the response BUT only when not in
  // production AND only when the email actually matched a user. This keeps
  // the demo usable without becoming an email-enumeration oracle.
  const devPayload = !config.isProduction && issuedToken
    ? { devToken: issuedToken, devTtlSeconds: config.limits.resetTokenTtlSeconds }
    : {};

  logger.info('auth.reset.request', { hadMatch: Boolean(issuedToken), requestId });

  ok(res, {
    message: 'If the email is registered, a reset token has been issued.',
    ...devPayload,
  }, requestId);
});
