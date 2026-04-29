/**
 * GET /api/admin/stats — dashboard summary + time series.
 *
 * The admin dashboard is the home of the Recharts visualizations. We project
 * only the aggregate counts and time-series buckets needed for the UI;
 * never raw user records or content. (S3.2.2.1 Confidentiality)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, ok } from '../_lib/request.js';
import {
  statsSummary, notesPerDay, listAudit,
} from '../_lib/db.js';
import { requireMethod, requireAdmin } from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['GET']);
  const admin = await requireAdmin(req);
  consume(`adminAction:${admin.id}`, limits.adminAction);

  ok(res, {
    summary: statsSummary(),
    notesPerDay: notesPerDay(14),
    recentAudit: listAudit(50),
  }, requestId);
});
