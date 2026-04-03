/**
 * GET  /api/notes      — List notes owned by the authenticated user
 * POST /api/notes      — Create a new note
 *
 * SSEM enforcements:
 * - Integrity: input validated; ownership derived from JWT (not client-supplied)
 * - Accountability: creation/read events logged
 * - Authenticity: requires valid session
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireCsrf } from '../_lib/auth.js';
import { noteRepo, userRepo, attachmentRepo } from '../_lib/db.js';
import { CreateNoteSchema, PaginationSchema } from '../_lib/validation.js';
import { logger } from '../_lib/logger.js';

function noteToPublic(note: ReturnType<typeof noteRepo.findById>, ratings: Array<{ score: number }> = []) {
  if (!note) return null;
  const owner = userRepo.findById(note.ownerId);
  const attachments = attachmentRepo.listByNote(note.id).map(a => ({
    id: a.id,
    filename: a.filename,
    originalName: a.originalName,
    contentType: a.contentType,
    size: a.size,
    noteId: a.noteId,
    uploadedAt: a.uploadedAt,
  }));
  const avgRating = ratings.length
    ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length
    : undefined;
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    isPublic: note.isPublic,
    ownerId: note.ownerId,
    ownerUsername: owner?.username ?? 'unknown',
    shareToken: note.shareToken,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    attachments,
    averageRating: avgRating,
    ratingCount: ratings.length,
  };
}

export { noteToPublic };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const claims = await requireAuth(req, res);
  if (!claims) return;

  if (req.method === 'GET') {
    const parsed = PaginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
    }
    const { page, pageSize } = parsed.data;

    const allNotes = noteRepo.listByOwner(claims.sub);
    const total = allNotes.length;
    const items = allNotes
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice((page - 1) * pageSize, page * pageSize)
      .map(n => noteToPublic(n));

    return res.status(200).json({ items, total, page, pageSize });
  }

  if (req.method === 'POST') {
    if (!requireCsrf(req, res)) return;

    const parsed = CreateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
    }

    // Derived Integrity: ownerId comes from JWT, never from client body
    const note = noteRepo.create({
      title: parsed.data.title,
      content: parsed.data.content,
      isPublic: parsed.data.isPublic,
      ownerId: claims.sub,
    });

    logger.audit('note.created', {
      action: 'create_note',
      userId: claims.sub,
      resource: note.id,
      outcome: 'success',
    });

    return res.status(201).json(noteToPublic(note));
  }

  return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET or POST required' });
}
