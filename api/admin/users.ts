/**
 * GET /api/admin/users — list users (admin only).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, ok } from '../_lib/request.js';
import { listUsers } from '../_lib/db.js';
import { userView } from '../_lib/views.js';
import { requireMethod, requireAdmin } from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['GET']);
  const admin = await requireAdmin(req);
  consume(`adminAction:${admin.id}`, limits.adminAction);
  ok(res, listUsers().map(userView), requestId);
});
