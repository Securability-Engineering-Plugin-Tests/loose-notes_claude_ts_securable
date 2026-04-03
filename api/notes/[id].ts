/**
 * GET    /api/notes/:id  — Get a note (owner or admin)
 * PUT    /api/notes/:id  — Update a note
 * DELETE /api/notes/:id  — Delete a note
 *
 * SSEM enforcements:
 * - Integrity: server-side ownership check on every mutation
 *   (PRD §8.2, §9.2 explicitly required no ownership check — corrected here)
 * - Authenticity: requires valid session
 * - Accountability: mutations logged with user + resource
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireCsrf } from '../_lib/auth.js';
import { noteRepo, ratingRepo } from '../_lib/db.js';
import { UpdateNoteSchema } from '../_lib/validation.js';
import { noteToPublic } from './index.js';
import { logger } from '../_lib/logger.js';
import { z } from 'zod';

const UuidSchema = z.string().uuid();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const claims = await requireAuth(req, res);
  if (!claims) return;

  // Validate note ID from route parameter
  const idResult = UuidSchema.safeParse(req.query.id);
  if (!idResult.success) {
    return res.status(400).json({ code: 'INVALID_ID', message: 'Invalid note identifier' });
  }
  const noteId = idResult.data;

  const note = noteRepo.findById(noteId);
  if (!note) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Note not found' });
  }

  if (req.method === 'GET') {
    // Owners and admins may read; non-owners can only read public notes
    if (note.ownerId !== claims.sub && claims.role !== 'admin' && !note.isPublic) {
      logger.audit('note.access.denied', {
        action: 'read_note',
        userId: claims.sub,
        resource: noteId,
        outcome: 'failure',
      });
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Access denied' });
    }
    const ratings = ratingRepo.findByNoteId(noteId);
    return res.status(200).json(noteToPublic(note, ratings));
  }

  if (req.method === 'PUT') {
    if (!requireCsrf(req, res)) return;

    // Server-side ownership check — PRD §8.2 required this to be absent
    if (note.ownerId !== claims.sub && claims.role !== 'admin') {
      logger.audit('note.edit.denied', {
        action: 'edit_note',
        userId: claims.sub,
        resource: noteId,
        outcome: 'failure',
      });
      return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this note' });
    }

    const parsed = UpdateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
    }

    const updated = noteRepo.update(noteId, parsed.data);
    logger.audit('note.updated', {
      action: 'edit_note',
      userId: claims.sub,
      resource: noteId,
      outcome: 'success',
    });
    return res.status(200).json(noteToPublic(updated));
  }

  if (req.method === 'DELETE') {
    if (!requireCsrf(req, res)) return;

    // Server-side ownership check — PRD §9.2 required this to be absent
    if (note.ownerId !== claims.sub && claims.role !== 'admin') {
      logger.audit('note.delete.denied', {
        action: 'delete_note',
        userId: claims.sub,
        resource: noteId,
        outcome: 'failure',
      });
      return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this note' });
    }

    noteRepo.delete(noteId);
    logger.audit('note.deleted', {
      action: 'delete_note',
      userId: claims.sub,
      resource: noteId,
      outcome: 'success',
    });
    return res.status(204).end();
  }

  return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET, PUT, or DELETE required' });
}
