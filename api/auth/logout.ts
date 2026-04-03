/**
 * POST /api/auth/logout
 *
 * Clears the session and CSRF cookies. Requires CSRF validation.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, clearSession, requireCsrf } from '../_lib/auth.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'POST required' });
  }

  if (!requireCsrf(req, res)) return;

  const claims = await requireAuth(req, res);
  if (!claims) return;

  clearSession(res);

  logger.audit('auth.logout', {
    action: 'logout',
    userId: claims.sub,
    outcome: 'success',
  });

  return res.status(200).json({ message: 'Logged out successfully' });
}
