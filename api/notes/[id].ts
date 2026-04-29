/**
 * /api/notes/[id]
 *   GET    — read one note (visibility check)
 *   PATCH  — update one note (ownership check)
 *   DELETE — delete one note (ownership check)
 *
 * FIASSE rejections:
 *  - §8.2 / §9.2: PRD requires loading and updating/deleting without a
 *    server-side ownership check, and without any CSRF token. REJECTED.
 *    Every state-changing path goes through requireUser → findNoteForOwner,
 *    plus enforceOrigin for CSRF defense-in-depth on top of SameSite=Strict.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handler, readJsonBody, ok, noContent,
} from '../_lib/request.js';
import { UpdateNoteSchema } from '../_lib/schemas.js';
import {
  findNoteForViewer, findNoteForOwner, updateNote, deleteNote,
  findUserById, listRatingsForNote, listAttachmentsForNote, appendAudit,
} from '../_lib/db.js';
import { stripHtml } from '../_lib/sanitize.js';
import { noteView, ratingView, attachmentView } from '../_lib/views.js';
import {
  requireMethod, requireUser, enforceOrigin, getAuthenticatedUser,
} from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';
import { Uuid } from '../_lib/schemas.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  const method = requireMethod(req, res, ['GET', 'PATCH', 'DELETE']);
  const idParam = (req.query.id ?? '').toString();
  const idCheck = Uuid.safeParse(idParam);
  if (!idCheck.success) throw new AppError('not_found', 'Note not found');
  const id = idCheck.data;

  if (method === 'GET') return read(req, res, requestId, id);
  if (method === 'PATCH') return update(req, res, requestId, id);
  return remove(req, res, requestId, id);
});

async function read(req: VercelRequest, res: VercelResponse, requestId: string, id: string): Promise<void> {
  const viewer = await getAuthenticatedUser(req);
  const note = findNoteForViewer(id, viewer ? { id: viewer.id, role: viewer.role } : null);
  if (!note) throw new AppError('not_found', 'Note not found');
  const owner = findUserById(note.ownerId);
  const ratings = listRatingsForNote(id).map((r) => ratingView(r, findUserById(r.raterId)));
  const attachments = listAttachmentsForNote(id).map(attachmentView);
  ok(res, { note: noteView(note, owner), ratings, attachments }, requestId);
}

async function update(req: VercelRequest, res: VercelResponse, requestId: string, id: string): Promise<void> {
  enforceOrigin(req);
  const user = await requireUser(req);
  consume(`noteWrite:${user.id}`, limits.noteWrite);

  const note = findNoteForOwner(id, { id: user.id, role: user.role });
  if (!note) throw new AppError('not_found', 'Note not found');

  const body = await readJsonBody(req, UpdateNoteSchema);
  const patch: { title?: string; content?: string; isPublic?: boolean } = {};
  if (body.title !== undefined) patch.title = stripHtml(body.title);
  if (body.content !== undefined) patch.content = stripHtml(body.content);
  if (body.isPublic !== undefined) patch.isPublic = body.isPublic;

  const updated = updateNote(id, patch);
  if (!updated) throw new AppError('not_found', 'Note not found');

  appendAudit({
    actorId: user.id,
    event: 'note.update',
    outcome: 'allow',
    context: { noteId: id, requestId },
  });
  ok(res, noteView(updated, findUserById(updated.ownerId)), requestId);
}

async function remove(req: VercelRequest, res: VercelResponse, requestId: string, id: string): Promise<void> {
  enforceOrigin(req);
  const user = await requireUser(req);
  consume(`noteWrite:${user.id}`, limits.noteWrite);

  const note = findNoteForOwner(id, { id: user.id, role: user.role });
  if (!note) throw new AppError('not_found', 'Note not found');

  deleteNote(id);
  appendAudit({
    actorId: user.id,
    event: 'note.delete',
    outcome: 'allow',
    context: { noteId: id, requestId },
  });
  noContent(res, requestId);
}
