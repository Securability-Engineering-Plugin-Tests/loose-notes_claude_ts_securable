/**
 * POST /api/auth/logout — clear the session cookie.
 *
 * The session is a stateless signed JWT; "logout" means clearing the cookie
 * client-side. For a true server-side revocation strategy with JWTs we'd add
 * a token-id deny-list (kid + jti); current TTL is 1 hour, so the residual
 * window is bounded. (S3.2.3.1 Availability vs. S3.2.2.3 trade-off)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, noContent } from '../_lib/request.js';
import { requireMethod, enforceOrigin, getAuthenticatedUser } from '../_lib/auth.js';
import { clearSession } from '../_lib/session.js';
import { appendAudit } from '../_lib/db.js';
import { logger } from '../_lib/logger.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['POST']);
  enforceOrigin(req);
  const user = await getAuthenticatedUser(req);
  clearSession(res);
  if (user) {
    appendAudit({
      actorId: user.id,
      event: 'auth.logout',
      outcome: 'info',
      context: { requestId },
    });
    logger.info('auth.logout', { userId: user.id, requestId });
  }
  noContent(res, requestId);
});
