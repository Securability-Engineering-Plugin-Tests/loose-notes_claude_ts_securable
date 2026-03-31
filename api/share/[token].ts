import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { shareLinkStore, noteStore, ratingStore, attachmentStore, userStore } from '../_lib/store.js';
import { audit } from '../_lib/audit.js';
import { buildNoteDetail } from '../notes/_noteHelpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required' } });
    return;
  }

  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token || token.length > 200) {
    res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid token' } });
    return;
  }

  const shareLink = shareLinkStore.findByToken(token);
  if (!shareLink) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Share link not found or expired' } });
    return;
  }

  if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
    res.status(410).json({ ok: false, error: { code: 'EXPIRED', message: 'Share link has expired' } });
    return;
  }

  const note = noteStore.findById(shareLink.noteId);
  if (!note) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Note not found' } });
    return;
  }

  audit({ userId: null, action: 'note.view_shared', resourceType: 'note', resourceId: shareLink.noteId, outcome: 'success', req });

  const detail = buildNoteDetail(note, ratingStore.findByNoteId(note.id), attachmentStore.findByNoteId(note.id), userStore);
  res.status(200).json({ ok: true, data: detail });
}
