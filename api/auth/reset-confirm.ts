/**
 * POST /api/auth/reset-confirm — consume a reset token and set a new password.
 *
 * Server-side state coordinates the two-step flow (in contrast to PRD §4.3,
 * which makes a client-controlled cookie the authoritative source of truth).
 * (S4.4.1.2 Derived Integrity)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'node:crypto';
import { handler, readJsonBody, ok } from '../_lib/request.js';
import { ResetConfirmSchema } from '../_lib/schemas.js';
import { consumeResetToken, updateUser, appendAudit } from '../_lib/db.js';
import { hashPassword } from '../_lib/crypto.js';
import { config } from '../_lib/config.js';
import { requireMethod, enforceOrigin } from '../_lib/auth.js';
import { consume, clientIdentifier, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';
import { clearSession } from '../_lib/session.js';
import { logger } from '../_lib/logger.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['POST']);
  enforceOrigin(req);
  consume(`resetConfirm:${clientIdentifier(req, 'reset')}`, limits.resetConfirm);

  const body = await readJsonBody(req, ResetConfirmSchema);
  const tokenHash = createHmac('sha256', config.resetSecret).update(body.token).digest('base64url');
  const consumed = consumeResetToken(tokenHash);
  if (!consumed) {
    appendAudit({
      actorId: null,
      event: 'auth.reset.confirm.failed',
      outcome: 'deny',
      context: { reason: 'invalid_or_expired', requestId },
    });
    throw new AppError('invalid_request', 'Reset token is invalid or expired');
  }

  updateUser(consumed.userId, { passwordHash: hashPassword(body.newPassword) });
  // Belt-and-braces: clear any session cookie present on this request so the
  // user is forced to log in with the new credentials.
  clearSession(res);

  appendAudit({
    actorId: consumed.userId,
    event: 'auth.reset.confirm.success',
    outcome: 'allow',
    context: { requestId },
  });
  logger.info('auth.reset.confirm.success', { userId: consumed.userId, requestId });

  ok(res, { message: 'Password updated. Please sign in with the new password.' }, requestId);
});
