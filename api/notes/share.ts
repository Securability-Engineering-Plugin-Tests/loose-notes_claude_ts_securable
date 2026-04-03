/**
 * POST /api/notes/share       — Generate a share link for a note (owner only)
 * GET  /api/notes/share/:token — Retrieve a shared note without authentication
 *
 * SSEM enforcements:
 * - Integrity: share token uses crypto.randomBytes (PRD §10.2 required sequential int)
 * - Authenticity: generation requires ownership verification
 * - Confidentiality: private note content only exposed via valid token
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireCsrf } from '../_lib/auth.js';
import { noteRepo, userRepo, ratingRepo, attachmentRepo } from '../_lib/db.js';
import { generateShareToken } from '../_lib/crypto.js';
import { logger } from '../_lib/logger.js';
import { z } from 'zod';

const GenerateShareSchema = z.object({ noteId: z.string().uuid() });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Generate share link — requires authentication and ownership
  if (req.method === 'POST') {
    const claims = await requireAuth(req, res);
    if (!claims) return;
    if (!requireCsrf(req, res)) return;

    const parsed = GenerateShareSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
    }

    const note = noteRepo.findById(parsed.data.noteId);
    if (!note) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Note not found' });
    }
    if (note.ownerId !== claims.sub) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this note' });
    }

    // Cryptographically secure random token — not sequential
    const token = generateShareToken();
    noteRepo.update(note.id, { shareToken: token });

    const baseUrl = process.env.APP_BASE_URL ?? '';
    logger.audit('note.share_link.created', {
      action: 'create_share_link',
      userId: claims.sub,
      resource: note.id,
      outcome: 'success',
    });

    return res.status(200).json({
      url: `${baseUrl}/share/${token}`,
      token,
    });
  }

  // Retrieve shared note — public endpoint, no auth required
  if (req.method === 'GET') {
    const tokenResult = z.string().min(1).max(100).safeParse(req.query.token);
    if (!tokenResult.success) {
      return res.status(400).json({ code: 'INVALID_TOKEN', message: 'Invalid share token' });
    }

    const note = noteRepo.findByShareToken(tokenResult.data);
    if (!note) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Shared note not found' });
    }

    const owner = userRepo.findById(note.ownerId);
    const ratings = ratingRepo.findByNoteId(note.id);
    const attachments = attachmentRepo.listByNote(note.id).map(a => ({
      id: a.id,
      filename: a.filename,
      originalName: a.originalName,
      contentType: a.contentType,
      size: a.size,
    }));
    const avg = ratings.length
      ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length
      : undefined;

    return res.status(200).json({
      id: note.id,
      title: note.title,
      content: note.content,
      ownerUsername: owner?.username ?? 'unknown',
      createdAt: note.createdAt,
      attachments,
      averageRating: avg,
      ratingCount: ratings.length,
    });
  }

  return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET or POST required' });
}
