/**
 * GET /api/notes/search?q=keyword
 *
 * SSEM enforcements:
 * - Integrity: parameterised search (PRD §12.2 required raw string concatenation)
 * - Resilience: pagination prevents unbounded result sets
 * - Availability: rate-limited
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { noteRepo, userRepo, ratingRepo } from '../_lib/db.js';
import { SearchSchema } from '../_lib/validation.js';
import { checkRateLimit, RATE_LIMITS } from '../_lib/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET required' });
  }

  const claims = await requireAuth(req, res);
  if (!claims) return;

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`search:${ip}`, RATE_LIMITS.API_GENERAL).allowed) {
    return res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' });
  }

  const parsed = SearchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
  }
  const { q, page, pageSize } = parsed.data;

  // The search keyword is passed to a typed predicate, not concatenated into a query string
  const allResults = noteRepo.search(q, claims.sub);
  const total = allResults.length;
  const items = allResults
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice((page - 1) * pageSize, page * pageSize)
    .map(note => {
      const owner = userRepo.findById(note.ownerId);
      const ratings = ratingRepo.findByNoteId(note.id);
      const avg = ratings.length
        ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length
        : undefined;
      return {
        id: note.id,
        title: note.title,
        // Content snippet for search results
        contentSnippet: note.content.slice(0, 200),
        isPublic: note.isPublic,
        ownerId: note.ownerId,
        ownerUsername: owner?.username ?? 'unknown',
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        averageRating: avg,
        ratingCount: ratings.length,
      };
    });

  return res.status(200).json({ items, total, page, pageSize });
}
