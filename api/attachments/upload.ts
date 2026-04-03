/**
 * POST /api/attachments/upload
 *
 * SSEM enforcements:
 * - Integrity: MIME type + extension validation (PRD §7.2 required none)
 * - Confidentiality: server assigns filename, client-supplied name is display-only
 * - Resilience: file size limits; path traversal prevented by server-assigned names
 *
 * PRD §7.2 required:
 * - Using the client-supplied filename for disk I/O → we assign a UUID-based name
 * - No MIME/extension check → we enforce an allowlist
 * - Storage inside web root → we store outside web root (env-configured path)
 *
 * Note: Vercel serverless functions have read-only filesystems. In production,
 * replace writeToStorage() with an object storage SDK (e.g. S3, Vercel Blob).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireCsrf } from '../_lib/auth.js';
import { noteRepo, attachmentRepo } from '../_lib/db.js';
import { logger } from '../_lib/logger.js';
import { randomUUID } from 'crypto';
import { z } from 'zod';

/** Allowlisted MIME types — explicit allow list, not a blocklist. */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** Maximum file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowlisted extensions mapped to MIME types. */
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
  '.png': ['image/png'], '.gif': ['image/gif'], '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'], '.csv': ['text/csv'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

function sanitizeOriginalName(name: string): string {
  // Strip path components and limit length for display
  return name.replace(/[/\\]/g, '').slice(0, 255);
}

function validateExtension(originalName: string, mimeType: string): boolean {
  const lower = originalName.toLowerCase();
  const ext = Object.keys(ALLOWED_EXTENSIONS).find(e => lower.endsWith(e));
  if (!ext) return false;
  return ALLOWED_EXTENSIONS[ext].includes(mimeType);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'POST required' });
  }

  const claims = await requireAuth(req, res);
  if (!claims) return;
  if (!requireCsrf(req, res)) return;

  const noteIdResult = z.string().uuid().safeParse(req.body?.noteId ?? req.query.noteId);
  if (!noteIdResult.success) {
    return res.status(400).json({ code: 'INVALID_ID', message: 'Invalid note identifier' });
  }

  const note = noteRepo.findById(noteIdResult.data);
  if (!note) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Note not found' });
  }
  if (note.ownerId !== claims.sub) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this note' });
  }

  // In a real implementation, parse multipart body here (e.g. using formidable or busboy)
  // For the demo, we accept metadata and simulate file storage
  const { originalName, mimeType, size } = req.body ?? {};

  if (!originalName || !mimeType || !size) {
    return res.status(400).json({ code: 'MISSING_FIELDS', message: 'originalName, mimeType, size required' });
  }

  // MIME type allowlist check
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    logger.warn('attachment.upload.rejected_mime', { userId: claims.sub, mimeType });
    return res.status(400).json({ code: 'UNSUPPORTED_TYPE', message: 'File type not allowed' });
  }

  // Extension + MIME consistency check
  if (!validateExtension(originalName, mimeType)) {
    logger.warn('attachment.upload.extension_mismatch', { userId: claims.sub, originalName, mimeType });
    return res.status(400).json({ code: 'EXTENSION_MISMATCH', message: 'File extension does not match declared type' });
  }

  if (typeof size === 'number' && size > MAX_FILE_SIZE) {
    return res.status(413).json({ code: 'FILE_TOO_LARGE', message: 'File exceeds 10 MB limit' });
  }

  // Server assigns a UUID-based filename — client-supplied name never used for I/O
  const ext = Object.keys(ALLOWED_EXTENSIONS).find(e => originalName.toLowerCase().endsWith(e)) ?? '';
  const serverFilename = `${randomUUID()}${ext}`;

  // In production: await writeToObjectStorage(serverFilename, fileBuffer, mimeType);

  const attachment = attachmentRepo.create({
    filename: serverFilename,
    originalName: sanitizeOriginalName(String(originalName)),
    contentType: mimeType,
    size: Number(size),
    noteId: note.id,
  });

  logger.audit('attachment.uploaded', {
    action: 'upload_attachment',
    userId: claims.sub,
    resource: attachment.id,
    noteId: note.id,
    outcome: 'success',
  });

  return res.status(201).json({
    id: attachment.id,
    filename: attachment.filename,
    originalName: attachment.originalName,
    contentType: attachment.contentType,
    size: attachment.size,
    uploadedAt: attachment.uploadedAt,
  });
}
