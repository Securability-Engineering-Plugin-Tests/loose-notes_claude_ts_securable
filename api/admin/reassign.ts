import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/auth.js';
import { noteStore, userStore } from '../_lib/store.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';

const reassignSchema = z.object({
  noteId: z.string().min(1).max(100),
  newOwnerId: z.string().min(1).max(100),
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } });
    return;
  }

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const body = parseBody(req.body, reassignSchema, res);
  if (!body) return;

  const note = noteStore.findById(body.noteId);
  if (!note) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Note not found' } });
    return;
  }

  const newOwner = userStore.findById(body.newOwnerId);
  if (!newOwner) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'New owner not found' } });
    return;
  }

  const previousOwnerId = note.ownerId;
  noteStore.update(body.noteId, { ownerId: body.newOwnerId });
  userStore.incrementNoteCount(previousOwnerId, -1);
  userStore.incrementNoteCount(body.newOwnerId, 1);

  audit({
    userId: ctx.userId, username: ctx.username,
    action: 'admin.reassign_note', resourceType: 'note', resourceId: body.noteId,
    outcome: 'success', details: `from:${previousOwnerId} to:${body.newOwnerId}`, req,
  });

  res.status(200).json({ ok: true, data: { message: 'Note reassigned successfully' } });
}
