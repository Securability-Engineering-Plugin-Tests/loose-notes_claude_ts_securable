/**
 * POST /api/export
 *
 * Export selected notes as a ZIP archive (JSON manifest + attachments).
 *
 * SSEM enforcements:
 * - Integrity: note IDs validated as UUIDs; ownership verified for each
 * - Resilience: path traversal prevention on file reads (PRD §20.2 required none)
 * - Confidentiality: only caller-owned notes exported
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireCsrf } from './_lib/auth.js';
import { noteRepo, attachmentRepo } from './_lib/db.js';
import { logger } from './_lib/logger.js';
import JSZip from 'jszip';
import { resolve, normalize, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { z } from 'zod';

const ExportSchema = z.object({
  noteIds: z.array(z.string().uuid()).min(1).max(100),
});

const ATTACHMENTS_BASE = resolve(process.env.ATTACHMENTS_DIR ?? '/tmp/attachments');

function isWithinBase(base: string, target: string): boolean {
  return normalize(target).startsWith(normalize(base) + '/');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'POST required' });
  }

  const claims = await requireAuth(req, res);
  if (!claims) return;
  if (!requireCsrf(req, res)) return;

  const parsed = ExportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
  }

  const zip = new JSZip();
  const manifest: object[] = [];

  for (const noteId of parsed.data.noteIds) {
    const note = noteRepo.findById(noteId);
    if (!note) continue;

    // Only export notes the caller owns
    if (note.ownerId !== claims.sub && claims.role !== 'admin') {
      continue;
    }

    const attachments = attachmentRepo.listByNote(noteId);
    const exportAttachments = [];

    for (const att of attachments) {
      // Resolve using the server-assigned filename, then validate path
      const filePath = join(ATTACHMENTS_BASE, att.filename);
      if (!isWithinBase(ATTACHMENTS_BASE, filePath)) {
        logger.error('export.path_traversal_prevented', { userId: claims.sub, attachmentId: att.id });
        continue;
      }
      if (existsSync(filePath)) {
        zip.file(`attachments/${att.filename}`, readFileSync(filePath));
      }
      exportAttachments.push({
        filename: att.filename,
        originalName: att.originalName,
        contentType: att.contentType,
      });
    }

    manifest.push({
      id: note.id,
      title: note.title,
      content: note.content,
      isPublic: note.isPublic,
      createdAt: note.createdAt,
      attachments: exportAttachments,
    });
  }

  zip.file('notes.json', JSON.stringify({ exportedAt: new Date().toISOString(), notes: manifest }, null, 2));

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  logger.audit('notes.exported', {
    action: 'export_notes',
    userId: claims.sub,
    count: manifest.length,
    outcome: 'success',
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="export_${timestamp}.zip"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).send(zipBuffer);
}
