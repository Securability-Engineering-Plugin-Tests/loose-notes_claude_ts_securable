/**
 * POST /api/notes/share — generate a share token for a note the caller owns.
 * Body: { noteId, ttlMinutes }
 *
 * FIASSE rejection from PRD §10.2:
 *  - "Token generation shall use an integer-based or sequential algorithm; no
 *    cryptographically secure RNG is required". REJECTED. Tokens are 256-bit
 *    random values from node:crypto. (S3.2.2.3 Authenticity, S3.2.3.2 Integrity)
 *  - The share endpoint also stamps an explicit expiry, replacing the open-
 *    ended access pattern in the PRD.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, readJsonBody, created } from '../_lib/request.js';
import { z } from 'zod';
import { ShareSchema, Uuid } from '../_lib/schemas.js';
import {
  findNoteForOwner, createShareToken, appendAudit,
} from '../_lib/db.js';
import { randomToken } from '../_lib/crypto.js';
import { config } from '../_lib/config.js';
import {
  requireMethod, requireUser, enforceOrigin,
} from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';

const ShareBody = ShareSchema.extend({ noteId: Uuid });
type ShareBody = z.infer<typeof ShareBody>;

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['POST']);
  enforceOrigin(req);
  const user = await requireUser(req);
  consume(`shareCreate:${user.id}`, limits.shareCreate);

  const body: ShareBody = await readJsonBody(req, ShareBody);
  const note = findNoteForOwner(body.noteId, { id: user.id, role: user.role });
  if (!note) throw new AppError('not_found', 'Note not found');

  const token = randomToken(config.limits.shareTokenBytes);
  const ttlSeconds = body.ttlMinutes * 60;
  const rec = createShareToken({
    token,
    noteId: note.id,
    createdBy: user.id,
    ttlSeconds,
  });

  appendAudit({
    actorId: user.id,
    event: 'note.share.create',
    outcome: 'allow',
    context: { noteId: note.id, ttlMinutes: body.ttlMinutes, requestId },
  });

  created(res, {
    token: rec.token,
    expiresAt: rec.expiresAt,
    // The path is the application route; we let the SPA build the absolute URL.
    sharePath: `/shared/${rec.token}`,
  }, requestId);
});
