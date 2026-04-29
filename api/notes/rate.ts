/**
 * POST /api/notes/rate — submit a rating for a visible note.
 * Body: { noteId, score, comment }
 *
 * FIASSE rejection from PRD §13.2:
 *  - "The note identifier, submitting user's email address, and comment text
 *    shall be incorporated into the data store insertion statement by direct
 *    string concatenation". REJECTED — no concatenation, only typed records.
 *  - "Stored rating comments are returned ... without any encoding
 *    transformation applied (see §6)". REJECTED — comments are stripped of
 *    HTML at storage and again at view-projection time.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { handler, readJsonBody, created } from '../_lib/request.js';
import { RatingSchema, Uuid } from '../_lib/schemas.js';
import {
  findNoteForViewer, createRating, findUserById, appendAudit,
} from '../_lib/db.js';
import { stripHtml } from '../_lib/sanitize.js';
import { ratingView } from '../_lib/views.js';
import {
  requireMethod, requireUser, enforceOrigin,
} from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';

const RateBody = RatingSchema.extend({ noteId: Uuid });
type RateBody = z.infer<typeof RateBody>;

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['POST']);
  enforceOrigin(req);
  const user = await requireUser(req);
  consume(`noteWrite:${user.id}`, limits.noteWrite);

  const body: RateBody = await readJsonBody(req, RateBody);

  // Caller must be able to see the note to rate it.
  const note = findNoteForViewer(body.noteId, { id: user.id, role: user.role });
  if (!note) throw new AppError('not_found', 'Note not found');

  const rating = createRating({
    noteId: note.id,
    raterId: user.id,
    score: body.score,
    comment: stripHtml(body.comment),
  });

  appendAudit({
    actorId: user.id,
    event: 'note.rate',
    outcome: 'allow',
    context: { noteId: note.id, score: body.score, requestId },
  });

  created(res, ratingView(rating, findUserById(user.id)), requestId);
});
