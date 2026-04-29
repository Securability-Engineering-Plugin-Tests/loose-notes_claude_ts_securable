/**
 * POST /api/admin/reassign — transfer ownership of a note to another user.
 *
 * FIASSE rejection from PRD §19.2:
 *  - "Update without requiring the requesting administrator to verify any
 *    prior ownership relationship": KEPT for the ADMIN role itself (admins
 *    are by definition authorized to reassign), but the operation is gated
 *    behind requireAdmin AND audit-logged so every reassignment is
 *    traceable. (S3.2.2.2 Accountability)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, readJsonBody, ok } from '../_lib/request.js';
import { ReassignSchema } from '../_lib/schemas.js';
import {
  findNoteById, findUserById, updateNote, appendAudit,
} from '../_lib/db.js';
import { noteView } from '../_lib/views.js';
import {
  requireMethod, requireAdmin, enforceOrigin,
} from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['POST']);
  enforceOrigin(req);
  const admin = await requireAdmin(req);
  consume(`adminAction:${admin.id}`, limits.adminAction);

  const body = await readJsonBody(req, ReassignSchema);
  const note = findNoteById(body.noteId);
  if (!note) throw new AppError('not_found', 'Note not found');

  const newOwner = findUserById(body.newOwnerId);
  if (!newOwner) throw new AppError('invalid_request', 'Target user not found');

  const previousOwnerId = note.ownerId;
  const updated = updateNote(note.id, { ownerId: newOwner.id });
  if (!updated) throw new AppError('internal_error', 'Could not reassign note');

  appendAudit({
    actorId: admin.id,
    event: 'admin.note.reassign',
    outcome: 'allow',
    context: {
      noteId: note.id,
      previousOwnerId,
      newOwnerId: newOwner.id,
      requestId,
    },
  });

  ok(res, noteView(updated, newOwner), requestId);
});
