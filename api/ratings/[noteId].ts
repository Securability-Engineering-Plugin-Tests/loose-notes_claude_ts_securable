import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { noteStore, ratingStore, userStore } from '../_lib/store.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';

const ratingSchema = z.object({
  value: z.number().int().min(1).max(5) as z.ZodType<1 | 2 | 3 | 4 | 5>,
  comment: z.string().max(1000).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'POST' && req.method !== 'PUT') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST or PUT required' } });
    return;
  }

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

  // Validate input at trust boundary
  const body = parseBody(req.body, ratingSchema, res);
  if (!body) return;

  const existing = ratingStore.findByNoteAndUser(noteId, ctx.userId);
  const now = new Date().toISOString();

  if (existing) {
    // Update existing rating
    existing.value = body.value;
    existing.comment = body.comment ?? null;
    existing.updatedAt = now;
    ratingStore.upsert(existing);
    audit({ userId: ctx.userId, username: ctx.username, action: 'rating.update', resourceType: 'rating', resourceId: existing.id, outcome: 'success', req });
    const ratingUser = userStore.findById(ctx.userId);
    res.status(200).json({ ok: true, data: { ...existing, username: ratingUser?.username ?? 'unknown' } });
  } else {
    const rating = ratingStore.upsert({
      id: randomUUID(),
      noteId,
      userId: ctx.userId,
      value: body.value,
      comment: body.comment ?? null,
      createdAt: now,
      updatedAt: now,
    });
    audit({ userId: ctx.userId, username: ctx.username, action: 'rating.create', resourceType: 'rating', resourceId: rating.id, outcome: 'success', req });
    const ratingUser = userStore.findById(ctx.userId);
    res.status(201).json({ ok: true, data: { ...rating, username: ratingUser?.username ?? 'unknown' } });
  }
}
