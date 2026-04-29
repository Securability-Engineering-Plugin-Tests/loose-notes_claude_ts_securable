/**
 * GET /api/notes/top — top-rated public notes.
 *
 * FIASSE rejection from PRD §17.2:
 *  - "Filter value supplied in the request shall be incorporated into the
 *    data query by concatenating it directly into the query expression,
 *    without validation or allowlisting": REJECTED. The filter is a strict
 *    enum (`global` or `recent`); unknown values are rejected at the
 *    schema boundary. (S3.2.3.2 Integrity)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, readQuery, ok } from '../_lib/request.js';
import { TopRatedSchema } from '../_lib/schemas.js';
import { topRatedPublicNotes, findUserById } from '../_lib/db.js';
import { noteView } from '../_lib/views.js';
import { requireMethod } from '../_lib/auth.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['GET']);
  const q = readQuery(req, TopRatedSchema);

  let items = topRatedPublicNotes(q.limit);
  if (q.region === 'recent') {
    const cutoff = Date.now() - 7 * 86400_000;
    items = items.filter((row) => new Date(row.note.createdAt).getTime() >= cutoff);
  }

  ok(res, items.map((row) => ({
    note: noteView(row.note, findUserById(row.note.ownerId)),
    avgScore: Math.round(row.avgScore * 100) / 100,
    ratingCount: row.ratingCount,
  })), requestId);
});
