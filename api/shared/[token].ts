/**
 * GET /api/shared/[token] — read a note via a share token.
 *
 * Public, unauthenticated endpoint by design — but the token itself IS the
 * authentication artifact. We:
 *   - require the token shape to match what we issue (256-bit base64url)
 *   - look up the token by exact match (constant-time DB lookup)
 *   - check expiry server-side
 *   - return only the projected NoteView, never the underlying record
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { handler, ok } from '../_lib/request.js';
import { findShareToken, findNoteById, findUserById, appendAudit } from '../_lib/db.js';
import { noteView } from '../_lib/views.js';
import { requireMethod } from '../_lib/auth.js';
import { consume, clientIdentifier, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';

// Tokens we issue are 32 bytes → 43 chars of base64url. We accept 32–64
// to allow for a future bump in token entropy without breaking existing.
const TokenShape = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['GET']);
  consume(`sharedRead:${clientIdentifier(req, 'shared')}`, limits.search);

  const token = TokenShape.safeParse((req.query.token ?? '').toString());
  if (!token.success) throw new AppError('not_found', 'Share link not found');

  const rec = findShareToken(token.data);
  if (!rec) {
    appendAudit({
      actorId: null,
      event: 'note.share.read.miss',
      outcome: 'deny',
      context: { requestId },
    });
    throw new AppError('not_found', 'Share link not found');
  }

  const note = findNoteById(rec.noteId);
  if (!note) throw new AppError('not_found', 'Share link not found');

  appendAudit({
    actorId: null,
    event: 'note.share.read',
    outcome: 'allow',
    context: { noteId: note.id, requestId },
  });

  ok(res, {
    note: noteView(note, findUserById(note.ownerId)),
    expiresAt: rec.expiresAt,
  }, requestId);
});
