/**
 * POST /api/ratings          — Submit a rating + comment for a note
 * GET  /api/ratings?noteId=  — Get ratings for a note
 *
 * SSEM enforcements:
 * - Integrity: parameterised insert (PRD §13.2 required string concatenation)
 * - Authenticity: requires valid session to submit
 * - Accountability: rating submissions logged
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireCsrf } from '../_lib/auth.js';
import { noteRepo, ratingRepo, userRepo } from '../_lib/db.js';
import { RatingSchema } from '../_lib/validation.js';
import { logger } from '../_lib/logger.js';
import { z } from 'zod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const claims = await requireAuth(req, res);
  if (!claims) return;

  if (req.method === 'GET') {
    const noteIdResult = z.string().uuid().safeParse(req.query.noteId);
    if (!noteIdResult.success) {
      return res.status(400).json({ code: 'INVALID_ID', message: 'Invalid note identifier' });
    }

    const note = noteRepo.findById(noteIdResult.data);
    if (!note) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Note not found' });
    }
    if (!note.isPublic && note.ownerId !== claims.sub && claims.role !== 'admin') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const ratings = ratingRepo.findByNoteId(noteIdResult.data).map(r => {
      const user = userRepo.findById(r.userId);
      return {
        id: r.id,
        noteId: r.noteId,
        userId: r.userId,
        username: user?.username ?? 'unknown',
        score: r.score,
        comment: r.comment,
        createdAt: r.createdAt,
      };
    });

    return res.status(200).json(ratings);
  }

  if (req.method === 'POST') {
    if (!requireCsrf(req, res)) return;

    const bodySchema = z.object({
      noteId: z.string().uuid(),
      ...RatingSchema.shape,
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
    }
    const { noteId, score, comment } = parsed.data;

    const note = noteRepo.findById(noteId);
    if (!note) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Note not found' });
    }
    if (!note.isPublic && note.ownerId !== claims.sub) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    // Derived Integrity: userId comes from JWT, not from client body (PRD §13.2)
    const rating = ratingRepo.create({
      noteId,
      userId: claims.sub,
      score,
      comment,
    });

    logger.audit('rating.submitted', {
      action: 'submit_rating',
      userId: claims.sub,
      resource: noteId,
      outcome: 'success',
    });

    return res.status(201).json({ id: rating.id, score: rating.score });
  }

  return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET or POST required' });
}
