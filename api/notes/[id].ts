import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { noteStore, ratingStore, attachmentStore, shareLinkStore, userStore } from '../_lib/store.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';
import { buildNoteDetail } from './_noteHelpers.js';

const updateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  visibility: z.enum(['public', 'private']),
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  // Extract note ID from query — Request Surface Minimization
  const noteId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!noteId) {
    res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Note ID required' } });
    return;
  }

  const note = noteStore.findById(noteId);
  if (!note) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Note not found' } });
    return;
  }

  if (req.method === 'GET') {
    return handleGet(req, res, noteId, note);
  }

  // Mutating operations require authentication
  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  if (req.method === 'PUT') {
    return handleUpdate(req, res, noteId, note, ctx);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res, noteId, note, ctx);
  }

  res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET, PUT, or DELETE required' } });
}

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  noteId: string,
  note: ReturnType<typeof noteStore.findById> & object
): Promise<void> {
  // Public notes are visible to anyone; private notes require ownership or admin
  if (note.visibility === 'private') {
    const { extractToken, verifyToken } = await import('../_lib/auth.js');
    const token = extractToken(req);
    const payload = token ? await verifyToken(token) : null;
    const isOwnerOrAdmin = payload && (payload.sub === note.ownerId || payload.role === 'admin');

    if (!isOwnerOrAdmin) {
      res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }
  }

  const detail = buildNoteDetail(
    note,
    ratingStore.findByNoteId(noteId),
    attachmentStore.findByNoteId(noteId),
    userStore
  );
  res.status(200).json({ ok: true, data: detail });
}

function handleUpdate(
  req: VercelRequest,
  res: VercelResponse,
  noteId: string,
  note: { ownerId: string },
  ctx: { userId: string; username: string; role: string }
): void {
  // Ownership check — only owner or admin may update (Authenticity)
  if (note.ownerId !== ctx.userId && ctx.role !== 'admin') {
    audit({ userId: ctx.userId, action: 'note.update', resourceType: 'note', resourceId: noteId, outcome: 'failure', details: 'unauthorized', req });
    res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not the note owner' } });
    return;
  }

  const body = parseBody(req.body, updateNoteSchema, res);
  if (!body) return;

  noteStore.update(noteId, { title: body.title, content: body.content, visibility: body.visibility, updatedAt: new Date().toISOString() });
  audit({ userId: ctx.userId, username: ctx.username, action: 'note.update', resourceType: 'note', resourceId: noteId, outcome: 'success', req });

  res.status(200).json({ ok: true, data: { message: 'Note updated' } });
}

function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  noteId: string,
  note: { ownerId: string },
  ctx: { userId: string; username: string; role: string }
): void {
  if (note.ownerId !== ctx.userId && ctx.role !== 'admin') {
    audit({ userId: ctx.userId, action: 'note.delete', resourceType: 'note', resourceId: noteId, outcome: 'failure', details: 'unauthorized', req });
    res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not the note owner' } });
    return;
  }

  // Cascade delete associated data (Integrity)
  ratingStore.deleteByNoteId(noteId);
  attachmentStore.deleteByNoteId(noteId);
  shareLinkStore.deleteByNoteId(noteId);
  noteStore.delete(noteId);
  userStore.incrementNoteCount(note.ownerId, -1);

  audit({ userId: ctx.userId, username: ctx.username, action: 'note.delete', resourceType: 'note', resourceId: noteId, outcome: 'success', req });

  res.status(200).json({ ok: true, data: { message: 'Note deleted' } });
}
