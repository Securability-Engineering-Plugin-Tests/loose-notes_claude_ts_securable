/**
 * GET /api/top-rated
 *
 * SSEM enforcements:
 * - Integrity: tag filter uses allowlist (PRD §17.2 required raw concatenation)
 * - Resilience: paginated to bound response size
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { noteRepo, userRepo, ratingRepo } from './_lib/db.js';
import { TopRatedFilterSchema } from './_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET required' });
  }

  // tag is validated against an enum allowlist — not concatenated into a query
  const parsed = TopRatedFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
  }
  const { tag, page, pageSize } = parsed.data;

  const topNotes = noteRepo.topRated(tag, 200); // Fetch more, then paginate
  const total = topNotes.length;
  const items = topNotes
    .slice((page - 1) * pageSize, page * pageSize)
    .map(n => {
      const owner = userRepo.findById(n.ownerId);
      const ratingList = ratingRepo.findByNoteId(n.id);
      return {
        id: n.id,
        title: n.title,
        ownerUsername: owner?.username ?? 'unknown',
        averageRating: n.avg,
        ratingCount: ratingList.length,
        createdAt: n.createdAt,
      };
    });

  return res.status(200).json({ items, total, page, pageSize });
}
