/**
 * GET /api/attachments/[id] — download an attachment.
 *
 * FIASSE rejections from PRD §23:
 *  - "Accept a user-supplied filename value": REJECTED. The client supplies
 *    only the attachment's UUID. The server-side filename is never
 *    constructed from a path component.
 *  - "If no file exists at the resolved path, render a status message that
 *    incorporates the original supplied filename value directly into the
 *    output text, without applying any encoding": REJECTED. Errors return
 *    a JSON envelope; React renders all text safely.
 *  - "No validation is performed to confirm that the resolved path falls
 *    within the intended base directory": MOOT — there is no path concat.
 *    Bytes are looked up by storage UUID in an in-memory map.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  findAttachment, readAttachmentBlob, findNoteForViewer, appendAudit,
} from '../_lib/db.js';
import {
  requireMethod, getAuthenticatedUser,
} from '../_lib/auth.js';
import { getRequestId } from '../_lib/request.js';
import { sendError } from '../_lib/errors.js';
import { AppError } from '../_lib/errors.js';
import { Uuid } from '../_lib/schemas.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = getRequestId(req);
  res.setHeader('X-Request-Id', requestId);
  try {
    requireMethod(req, res, ['GET']);

    const idParse = Uuid.safeParse((req.query.id ?? '').toString());
    if (!idParse.success) throw new AppError('not_found', 'Attachment not found');

    const att = findAttachment(idParse.data);
    if (!att) throw new AppError('not_found', 'Attachment not found');

    // Ownership / visibility: caller can read the attachment iff they can
    // read the underlying note.
    const viewer = await getAuthenticatedUser(req);
    const note = findNoteForViewer(att.noteId, viewer ? { id: viewer.id, role: viewer.role } : null);
    if (!note) throw new AppError('not_found', 'Attachment not found');

    const blob = readAttachmentBlob(att.storageName);
    if (!blob) throw new AppError('not_found', 'Attachment not found');

    appendAudit({
      actorId: viewer?.id ?? null,
      event: 'attachment.download',
      outcome: 'allow',
      context: { attachmentId: att.id, noteId: note.id, requestId },
    });

    res.setHeader('Content-Type', att.contentType);
    res.setHeader('Content-Length', String(blob.length));
    // Always force download (avoid in-browser HTML rendering of unexpected
    // content types). RFC 6266 encoding for the filename.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${rfc6266Quote(att.originalName)}"; filename*=UTF-8''${encodeURIComponent(att.originalName)}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).end(blob);
  } catch (err) {
    sendError(res, err, requestId);
    logger.warn('attachment.download.error', { requestId });
  }
}

function rfc6266Quote(s: string): string {
  return s.replace(/[\\"]/g, '_');
}
