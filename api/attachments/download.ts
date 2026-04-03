/**
 * GET /api/attachments/download?attachmentId=<uuid>
 *
 * SSEM enforcements:
 * - Integrity: attachment resolved by UUID (not user-supplied filename), preventing path traversal
 * - Confidentiality: caller must have access to the owning note
 * - Resilience: path is validated against base directory even after UUID lookup
 *
 * PRD §23.2 required:
 * - User-supplied filename combined with base dir → path traversal risk
 * - Filename reflected in error responses without encoding → XSS risk
 * Both are corrected here.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { attachmentRepo, noteRepo } from '../_lib/db.js';
import { AttachmentDownloadSchema } from '../_lib/validation.js';
import { resolve, normalize, join } from 'path';
import { existsSync, createReadStream } from 'fs';
import { logger } from '../_lib/logger.js';

const ATTACHMENTS_BASE = resolve(process.env.ATTACHMENTS_DIR ?? '/tmp/attachments');

/** Verify resolved path is within the expected base directory (path-traversal jail). */
function isWithinBase(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalize(basePath) + '/';
  const normalizedTarget = normalize(targetPath);
  return normalizedTarget.startsWith(normalizedBase);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET required' });
  }

  const claims = await requireAuth(req, res);
  if (!claims) return;

  // Resolve by UUID, not by user-supplied filename
  const parsed = AttachmentDownloadSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid attachment identifier' });
  }

  const attachment = attachmentRepo.findById(parsed.data.attachmentId);
  if (!attachment) {
    // Generic error — do not reflect user input in the response
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Attachment not found' });
  }

  // Authorisation: caller must have access to the owning note
  const note = noteRepo.findById(attachment.noteId);
  if (!note) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Attachment not found' });
  }
  if (!note.isPublic && note.ownerId !== claims.sub && claims.role !== 'admin') {
    logger.audit('attachment.download.denied', {
      action: 'download_attachment',
      userId: claims.sub,
      resource: attachment.id,
      outcome: 'failure',
    });
    return res.status(403).json({ code: 'FORBIDDEN', message: 'Access denied' });
  }

  // Path traversal jail — even though we use the server-assigned UUID filename,
  // we still validate the resolved path is within the base directory
  const filePath = join(ATTACHMENTS_BASE, attachment.filename);
  if (!isWithinBase(ATTACHMENTS_BASE, filePath)) {
    logger.error('attachment.download.path_traversal_detected', {
      userId: claims.sub,
      attachmentId: attachment.id,
    });
    return res.status(400).json({ code: 'INVALID_PATH', message: 'Invalid file path' });
  }

  if (!existsSync(filePath)) {
    // File missing from storage — report generic error, not the path
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Attachment file not available' });
  }

  // Content-Disposition uses originalName for the download filename
  // Encoded to prevent header injection
  const safeDisplayName = encodeURIComponent(attachment.originalName);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeDisplayName}`);
  res.setHeader('Content-Type', attachment.contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  createReadStream(filePath).pipe(res);
}
