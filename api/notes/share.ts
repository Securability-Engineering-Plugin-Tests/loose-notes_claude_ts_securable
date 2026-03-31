import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { noteStore, shareLinkStore } from '../_lib/store.js';
import { audit } from '../_lib/audit.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const noteId = typeof req.query.noteId === 'string' ? req.query.noteId : null;
  if (!noteId) {
    res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'noteId required' } });
    return;
  }

  const note = noteStore.findById(noteId);
  if (!note) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Note not found' } });
    return;
  }

  if (note.ownerId !== ctx.userId && ctx.role !== 'admin') {
    res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not the note owner' } });
    return;
  }

  if (req.method === 'POST') {
    return handleCreate(req, res, noteId, ctx);
  }

  if (req.method === 'DELETE') {
    return handleRevoke(req, res, noteId, ctx);
  }

  res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST or DELETE required' } });
}

function handleCreate(req: VercelRequest, res: VercelResponse, noteId: string, ctx: { userId: string; username: string }): void {
  // Revoke any existing share link before creating new one (regenerate)
  shareLinkStore.deleteByNoteId(noteId);

  const token = randomBytes(24).toString('hex');
  const link = shareLinkStore.create({
    id: `sl-${token.slice(0, 8)}`,
    noteId,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });

  audit({ userId: ctx.userId, username: ctx.username, action: 'note.share_create', resourceType: 'share_link', resourceId: noteId, outcome: 'success', req });

  res.status(201).json({ ok: true, data: { token: link.token } });
}

function handleRevoke(req: VercelRequest, res: VercelResponse, noteId: string, ctx: { userId: string; username: string }): void {
  shareLinkStore.deleteByNoteId(noteId);
  audit({ userId: ctx.userId, username: ctx.username, action: 'note.share_revoke', resourceType: 'share_link', resourceId: noteId, outcome: 'success', req });
  res.status(200).json({ ok: true, data: { message: 'Share link revoked' } });
}
