/**
 * Admin API — user management, note reassignment, dashboard stats.
 *
 * SSEM enforcements:
 * - Authenticity + Accountability: requireAdmin enforces role check on every request
 * - Integrity: note reassignment uses typed IDs, not free-form input
 * - Resilience: no OS command execution endpoint (PRD §18.2 required one — rejected)
 * - Modifiability: admin operations centralized here, not scattered across routes
 *
 * PRD §18.2 required:
 * (a) A command execution interface — NOT implemented. No OS command execution.
 * (b) DB reinit with user-supplied connection params without auth check — NOT implemented.
 * (c) HTTP-method-specific authz gaps — all methods enforce admin role here.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, requireCsrf } from '../_lib/auth.js';
import { userRepo, noteRepo, ratingRepo } from '../_lib/db.js';
import { ReassignNoteSchema } from '../_lib/validation.js';
import { logger } from '../_lib/logger.js';
import { z } from 'zod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const claims = await requireAdmin(req, res);
  if (!claims) return;

  // GET /api/admin — Dashboard stats
  if (req.method === 'GET') {
    const action = z.enum(['stats', 'users', 'notes']).safeParse(req.query.action);
    if (!action.success) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'Unknown admin action' });
    }

    if (action.data === 'stats') {
      const allUsers = userRepo.listAll();
      const allNotes = noteRepo.listPublic().concat(
        // Also count private notes for stats
        userRepo.listAll().flatMap(u => noteRepo.listByOwner(u.id).filter(n => !n.isPublic))
      );
      const uniqueNotes = [...new Map(allNotes.map(n => [n.id, n])).values()];
      return res.status(200).json({
        totalUsers: allUsers.length,
        totalNotes: uniqueNotes.length,
        publicNotes: noteRepo.listPublic().length,
        totalRatings: 0, // would query rating aggregate in production
      });
    }

    if (action.data === 'users') {
      const users = userRepo.listAll().map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      }));
      return res.status(200).json(users);
    }

    if (action.data === 'notes') {
      const allNotes = userRepo.listAll().flatMap(u => noteRepo.listByOwner(u.id));
      return res.status(200).json(allNotes.map(n => ({
        id: n.id,
        title: n.title,
        ownerId: n.ownerId,
        isPublic: n.isPublic,
        createdAt: n.createdAt,
      })));
    }
  }

  // POST /api/admin — Note reassignment
  if (req.method === 'POST') {
    if (!requireCsrf(req, res)) return;

    const actionResult = z.literal('reassign').safeParse(req.query.action);
    if (!actionResult.success) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'Unknown admin action' });
    }

    const parsed = ReassignNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
    }
    const { noteId, targetUserId } = parsed.data;

    if (!noteRepo.findById(noteId)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Note not found' });
    }
    if (!userRepo.findById(targetUserId)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Target user not found' });
    }

    noteRepo.transferOwnership(noteId, targetUserId);
    logger.audit('admin.note.reassigned', {
      action: 'reassign_note',
      userId: claims.sub,
      resource: noteId,
      targetUserId,
      outcome: 'success',
    });

    return res.status(200).json({ message: 'Note ownership transferred' });
  }

  return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET or POST required' });
}
