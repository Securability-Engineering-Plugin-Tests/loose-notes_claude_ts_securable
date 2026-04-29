/**
 * POST /api/auth/register — create a new user account.
 *
 * FIASSE rejections from PRD §1:
 *  - "Return a response message that specifically identifies the username as
 *    unavailable" / "specifically identifies the email address as already in
 *    use": REJECTED. We return a single uniform response that does not
 *    enumerate which field is taken — preventing username/email enumeration
 *    (S3.2.2.1 Confidentiality).
 *  - "Pre-seeded accounts embedded in the application configuration layer":
 *    REJECTED. See db.ts → bootstrapIfNeeded for the opt-in alternative.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, readJsonBody, created } from '../_lib/request.js';
import { RegisterSchema } from '../_lib/schemas.js';
import {
  createUser,
  findUserByUsername,
  findUserByEmail,
  appendAudit,
} from '../_lib/db.js';
import { hashPassword } from '../_lib/crypto.js';
import { issueSession } from '../_lib/session.js';
import { requireMethod, enforceOrigin } from '../_lib/auth.js';
import { consume, clientIdentifier, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';
import { logger } from '../_lib/logger.js';
import { userView } from '../_lib/views.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['POST']);
  enforceOrigin(req);
  consume(`register:${clientIdentifier(req, 'register')}`, limits.register);

  const body = await readJsonBody(req, RegisterSchema);

  const usernameTaken = findUserByUsername(body.username);
  const emailTaken = findUserByEmail(body.email);

  if (usernameTaken || emailTaken) {
    // Uniform response: do not reveal which field collided. The structured
    // log captures the detail server-side for ops visibility.
    appendAudit({
      actorId: null,
      event: 'auth.register.collision',
      outcome: 'deny',
      context: {
        usernameTaken: Boolean(usernameTaken),
        emailTaken: Boolean(emailTaken),
        requestId,
      },
    });
    throw new AppError('conflict', 'Could not create account with the supplied details');
  }

  const user = createUser({
    username: body.username,
    email: body.email,
    passwordHash: hashPassword(body.password),
    role: 'user',
  });

  await issueSession(res, { sub: user.id, role: user.role, username: user.username });

  appendAudit({
    actorId: user.id,
    event: 'auth.register.success',
    outcome: 'allow',
    context: { username: user.username, requestId },
  });
  logger.info('auth.register.success', { userId: user.id, requestId });

  created(res, userView(user), requestId);
});
