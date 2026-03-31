import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { noteStore, ratingStore, userStore } from '../_lib/store.js';
import { extractToken, verifyToken } from '../_lib/auth.js';
import { buildNoteListItem } from './_noteHelpers.js';

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required' } });
    return;
  }

  // Optional auth — affects which private notes are visible
  const token = extractToken(req);
  const payload = token ? await verifyToken(token) : null;
  const requestingUserId = payload?.sub ?? null;

  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid search parameters' } });
    return;
  }

  const { q, page, limit } = parsed.data;
  // Canonicalize search term — sanitize for safe comparison (Integrity)
  const term = q.normalize('NFC').trim().toLowerCase();

  const allNotes = noteStore.list().filter((n) => {
    // Visibility rule: public notes OR notes owned by the requester
    if (n.visibility !== 'public' && n.ownerId !== requestingUserId) return false;
    // Case-insensitive match on title or content (Integrity — no SQL injection risk in in-memory)
    return n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term);
  });

  const total = allNotes.length;
  const offset = (page - 1) * limit;
  const pageItems = allNotes
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(offset, offset + limit)
    .map((n) => buildNoteListItem(n, ratingStore.findByNoteId(n.id), userStore));

  res.status(200).json({
    ok: true,
    data: { items: pageItems, total, page, limit, hasMore: offset + limit < total },
  });
}
