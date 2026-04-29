/**
 * /api/users/me
 *   GET   — read profile
 *   PATCH — update email or password
 *
 * FIASSE rejections from PRD §16:
 *  - "Identify the user whose record to display by reading a user-identifier
 *    value from a browser cookie": REJECTED. The user is the verified
 *    session subject — we never read a separate id cookie. (S4.4.1.2)
 *  - "Profile response shall include the user's email address and stored
 *    credential fields": REJECTED. We never return passwordHash.
 *  - "Validate only that the two submitted password entries match; no
 *    minimum-length, complexity, or policy check": REJECTED. New password
 *    must satisfy the schema-level minimum (≥12 chars).
 *  - "Identify which account to update using the same cookie-based
 *    identifier, without performing a server-side ownership check":
 *    REJECTED. The session subject IS the account id; users can only
 *    update their own account here.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, readJsonBody, ok } from '../_lib/request.js';
import { UpdateProfileSchema } from '../_lib/schemas.js';
import { findUserById, findUserByEmail, updateUser, appendAudit } from '../_lib/db.js';
import { hashPassword, verifyPassword } from '../_lib/crypto.js';
import { userView } from '../_lib/views.js';
import {
  requireMethod, requireUser, enforceOrigin,
} from '../_lib/auth.js';
import { AppError } from '../_lib/errors.js';
import { logger } from '../_lib/logger.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  const method = requireMethod(req, res, ['GET', 'PATCH']);
  if (method === 'GET') return read(req, res, requestId);
  return update(req, res, requestId);
});

async function read(req: VercelRequest, res: VercelResponse, requestId: string): Promise<void> {
  const user = await requireUser(req);
  const fresh = findUserById(user.id);
  if (!fresh) throw new AppError('unauthenticated', 'Session no longer valid');
  ok(res, userView(fresh), requestId);
}

async function update(req: VercelRequest, res: VercelResponse, requestId: string): Promise<void> {
  enforceOrigin(req);
  const user = await requireUser(req);
  const fresh = findUserById(user.id);
  if (!fresh) throw new AppError('unauthenticated', 'Session no longer valid');

  const body = await readJsonBody(req, UpdateProfileSchema);

  const patch: { email?: string; passwordHash?: string } = {};

  if (body.email && body.email !== fresh.email) {
    const collision = findUserByEmail(body.email);
    if (collision && collision.id !== fresh.id) {
      throw new AppError('conflict', 'Could not update email');
    }
    patch.email = body.email;
  }

  if (body.newPassword) {
    if (!body.currentPassword) throw new AppError('invalid_request', 'currentPassword required');
    if (!verifyPassword(body.currentPassword, fresh.passwordHash)) {
      appendAudit({
        actorId: fresh.id,
        event: 'profile.password_change.denied',
        outcome: 'deny',
        context: { reason: 'wrong_current_password', requestId },
      });
      throw new AppError('forbidden', 'Current password did not match');
    }
    patch.passwordHash = hashPassword(body.newPassword);
  }

  if (Object.keys(patch).length === 0) {
    ok(res, userView(fresh), requestId);
    return;
  }

  const updated = updateUser(fresh.id, patch);
  if (!updated) throw new AppError('internal_error', 'Could not update profile');

  appendAudit({
    actorId: fresh.id,
    event: 'profile.update',
    outcome: 'allow',
    context: {
      changedEmail: Boolean(patch.email),
      changedPassword: Boolean(patch.passwordHash),
      requestId,
    },
  });
  logger.info('profile.update', { userId: fresh.id, requestId });

  ok(res, userView(updated), requestId);
}
