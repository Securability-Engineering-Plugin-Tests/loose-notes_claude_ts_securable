import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { noteStore, ratingStore, attachmentStore, userStore } from '../_lib/store.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';
import { buildNoteListItem } from './_noteHelpers.js';

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  visibility: z.enum(['public', 'private']),
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  if (req.method === 'GET') {
    return handleList(ctx.userId, res);
  }

  if (req.method === 'POST') {
    return handleCreate(req, res, ctx);
  }

  res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET or POST required' } });
}

function handleList(userId: string, res: VercelResponse): void {
  // Return only the requesting user's notes (owns all returned items)
  const userNotes = noteStore.list().filter((n) => n.ownerId === userId);
  const items = userNotes
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((n) => buildNoteListItem(n, ratingStore.findByNoteId(n.id), userStore));

  res.status(200).json({ ok: true, data: items });
}

async function handleCreate(req: VercelRequest, res: VercelResponse, ctx: { userId: string; username: string }): Promise<void> {
  const body = parseBody(req.body, createNoteSchema, res);
  if (!body) return;

  const now = new Date().toISOString();
  const note = noteStore.create({
    id: randomUUID(),
    title: body.title,
    content: body.content,
    visibility: body.visibility,
    ownerId: ctx.userId,
    createdAt: now,
    updatedAt: now,
  });

  userStore.incrementNoteCount(ctx.userId, 1);
  audit({ userId: ctx.userId, username: ctx.username, action: 'note.create', resourceType: 'note', resourceId: note.id, outcome: 'success', req });

  const item = buildNoteListItem(note, [], userStore);
  res.status(201).json({ ok: true, data: item });
}
