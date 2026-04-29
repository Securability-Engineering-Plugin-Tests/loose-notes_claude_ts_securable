/**
 * /api/notes
 *   GET  — search notes visible to the caller
 *   POST — create a new note
 *
 * FIASSE rejections:
 *  - §11/§12: PRD requires keyword concatenation into the query and
 *    private-note exclusion as a "filter predicate" rather than row-level
 *    access control. REJECTED. searchNotes derives the viewer from the
 *    verified session and applies access checks before returning rows.
 *  - §5: notes default to private (already in PRD spec) — kept.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handler, readJsonBody, readQuery, ok, created,
} from '../_lib/request.js';
import { CreateNoteSchema, SearchSchema } from '../_lib/schemas.js';
import {
  searchNotes, createNote, findUserById, countNotesForOwner, appendAudit,
} from '../_lib/db.js';
import { stripHtml } from '../_lib/sanitize.js';
import { noteView } from '../_lib/views.js';
import {
  requireMethod, requireUser, enforceOrigin, getAuthenticatedUser,
} from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';
import { config } from '../_lib/config.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  const method = requireMethod(req, res, ['GET', 'POST']);
  if (method === 'GET') return list(req, res, requestId);
  return create(req, res, requestId);
});

async function list(req: VercelRequest, res: VercelResponse, requestId: string): Promise<void> {
  // Search is allowed for anonymous users but only returns public notes.
  const viewer = await getAuthenticatedUser(req);
  if (viewer) consume(`search:user:${viewer.id}`, limits.search);

  const q = readQuery(req, SearchSchema);
  let { items, total } = searchNotes({
    keyword: q.q,
    viewer: viewer ? { id: viewer.id, role: viewer.role } : null,
    limit: q.limit,
    offset: q.offset,
  });

  if (q.filter === 'mine') {
    if (!viewer) throw new AppError('unauthenticated', 'Authentication required');
    items = items.filter((n) => n.ownerId === viewer.id);
    total = items.length;
  } else if (q.filter === 'public') {
    items = items.filter((n) => n.isPublic);
    total = items.length;
  }

  const views = items.map((n) => noteView(n, findUserById(n.ownerId)));
  ok(res, { items: views, total, limit: q.limit, offset: q.offset }, requestId);
}

async function create(req: VercelRequest, res: VercelResponse, requestId: string): Promise<void> {
  enforceOrigin(req);
  const user = await requireUser(req);
  consume(`noteWrite:${user.id}`, limits.noteWrite);

  const body = await readJsonBody(req, CreateNoteSchema);

  // Per-user note quota — Availability boundary control (S3.2.3.1).
  if (countNotesForOwner(user.id) >= config.limits.maxNotesPerUser) {
    throw new AppError('forbidden', `Maximum ${config.limits.maxNotesPerUser} notes per account`);
  }

  // We strip HTML at the storage boundary so the canonical stored form is
  // already inert — defense-in-depth over view-time sanitization.
  const note = createNote({
    ownerId: user.id,
    title: stripHtml(body.title),
    content: stripHtml(body.content),
    isPublic: body.isPublic,
  });

  appendAudit({
    actorId: user.id,
    event: 'note.create',
    outcome: 'allow',
    context: { noteId: note.id, isPublic: note.isPublic, requestId },
  });

  created(res, noteView(note, findUserById(note.ownerId)), requestId);
}
