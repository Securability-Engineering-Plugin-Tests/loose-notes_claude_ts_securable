// Attachment metadata API — REQ-005 (File Attachment)
// NOTE: Actual file storage requires an external service (Vercel Blob, S3, etc.)
// This endpoint validates and records attachment metadata; replace the storage
// stub with a real provider for production use.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { noteStore, attachmentStore } from '../_lib/store.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';

// ASVS V12.1 (File Upload), V12.2 (File Integrity)
// Allowed MIME types — strict allowlist (never use client-supplied MIME)
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
]);

const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE ?? '10485760', 10); // 10 MB default

const attachmentMetaSchema = z.object({
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
  // storedFilename would be set by the storage provider
});

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

  // Only note owner or admin can add/remove attachments
  if (note.ownerId !== ctx.userId && ctx.role !== 'admin') {
    res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not the note owner' } });
    return;
  }

  if (req.method === 'GET') {
    const items = attachmentStore.findByNoteId(noteId);
    res.status(200).json({ ok: true, data: items });
    return;
  }

  if (req.method === 'POST') {
    const body = parseBody(req.body, attachmentMetaSchema, res);
    if (!body) return;

    // Validate MIME type against allowlist — never trust client-supplied MIME (Integrity)
    if (!ALLOWED_MIME_TYPES.has(body.mimeType)) {
      res.status(400).json({
        ok: false,
        error: { code: 'INVALID_FILE_TYPE', message: 'File type not allowed' },
      });
      return;
    }

    // In production: upload the file to storage here, then record metadata.
    // The storedFilename uses a UUID to prevent path traversal / filename collisions.
    const storedFilename = `${randomUUID()}-${body.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const attachment = attachmentStore.create({
      id: randomUUID(),
      noteId,
      originalFilename: body.originalFilename,
      storedFilename,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      uploadedAt: new Date().toISOString(),
    });

    audit({
      userId: ctx.userId,
      username: ctx.username,
      action: 'attachment.upload',
      resourceType: 'attachment',
      resourceId: attachment.id,
      outcome: 'success',
      req,
    });

    res.status(201).json({ ok: true, data: attachment });
    return;
  }

  if (req.method === 'DELETE') {
    const attachmentId = typeof req.query.attachmentId === 'string' ? req.query.attachmentId : null;
    if (!attachmentId) {
      res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'attachmentId required' } });
      return;
    }

    const deleted = attachmentStore.delete(attachmentId);
    if (!deleted) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } });
      return;
    }

    audit({
      userId: ctx.userId,
      username: ctx.username,
      action: 'attachment.delete',
      resourceType: 'attachment',
      resourceId: attachmentId,
      outcome: 'success',
      req,
    });

    res.status(200).json({ ok: true, data: { message: 'Attachment deleted' } });
    return;
  }

  res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET, POST, or DELETE required' } });
}
