/**
 * GET /api/auth/me — return the authenticated user's profile.
 *
 * The user record is loaded from the data store using the verified session
 * subject — never from a separate client cookie. (S4.4.1.2 Derived Integrity)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, ok } from '../_lib/request.js';
import { requireMethod, getAuthenticatedUser } from '../_lib/auth.js';
import { findUserById } from '../_lib/db.js';
import { userView } from '../_lib/views.js';
import { AppError } from '../_lib/errors.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['GET']);
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    // /me is a "is there a session?" probe — return 200 with null so the
    // SPA can branch without a noisy 401 in the dev console.
    ok(res, null, requestId);
    return;
  }
  const user = findUserById(auth.id);
  if (!user) throw new AppError('unauthenticated', 'Session no longer valid');
  ok(res, userView(user), requestId);
});
