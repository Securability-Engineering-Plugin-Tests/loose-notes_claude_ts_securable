/**
 * POST /api/attachments — upload a file as an attachment for a note.
 *
 * Body: multipart/form-data with fields `noteId` and `file`.
 *
 * FIASSE rejections from PRD §7:
 *  - "Accept any file submitted by the client": REJECTED. We enforce a
 *    size cap (5 MB) and a MIME-type allowlist; oversized or disallowed
 *    types are rejected before any byte is persisted.
 *  - "File shall be saved to a designated directory under the application's
 *    web-accessible root": REJECTED. Bytes are stored OUTSIDE the webroot —
 *    in this demo, in process memory, keyed by a server-generated UUID. They
 *    are reachable ONLY through the authenticated download handler, which
 *    enforces visibility before serving them.
 *  - "Filename used when persisting the file shall be the filename as
 *    supplied by the client": REJECTED. Storage uses a server-generated
 *    UUID; the client filename is preserved as `originalName` and emitted
 *    only in Content-Disposition where it is encoded per RFC 6266.
 *  - "Shall not inspect the submitted file's extension, MIME type, or
 *    byte-level content": REJECTED. We sniff the magic bytes for the most
 *    common types and reject when declared and sniffed types disagree.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { handler, ok, created } from '../_lib/request.js';
import {
  findNoteForOwner, createAttachment, countAttachmentsForOwner, appendAudit,
} from '../_lib/db.js';
import { attachmentView } from '../_lib/views.js';
import {
  requireMethod, requireUser, enforceOrigin,
} from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';
import { AppError } from '../_lib/errors.js';
import { config } from '../_lib/config.js';
import { Uuid } from '../_lib/schemas.js';

const ALLOWED_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
]);

interface MultipartParts {
  fields: Record<string, string>;
  file: { filename: string; contentType: string; data: Buffer } | null;
}

// @vercel/node leaves multipart/form-data bodies unparsed and exposes the raw
// request stream. We read it manually below with a hard size cap.
export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  const method = requireMethod(req, res, ['POST', 'GET']);
  if (method === 'GET') {
    // Light status probe — confirms the upload route is reachable for the SPA.
    ok(res, { allowedTypes: [...ALLOWED_TYPES], maxBytes: config.limits.maxAttachmentBytes }, requestId);
    return;
  }

  enforceOrigin(req);
  const user = await requireUser(req);
  consume(`upload:${user.id}`, limits.upload);

  if (countAttachmentsForOwner(user.id) >= config.limits.maxAttachmentsPerUser) {
    throw new AppError('forbidden', `Maximum ${config.limits.maxAttachmentsPerUser} attachments per account`);
  }

  const ct = (req.headers['content-type'] ?? '').toString();
  const boundaryMatch = /boundary=([^;]+)/i.exec(ct);
  if (!boundaryMatch) throw new AppError('invalid_request', 'Multipart form-data with boundary required');
  const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '');

  const raw = await readBody(req, config.limits.maxAttachmentBytes + 64 * 1024);
  const { fields, file } = parseMultipart(raw, boundary);

  const noteIdParse = Uuid.safeParse(fields.noteId ?? '');
  if (!noteIdParse.success) throw new AppError('invalid_request', 'noteId is required');
  if (!file) throw new AppError('invalid_request', 'file part is required');

  const note = findNoteForOwner(noteIdParse.data, { id: user.id, role: user.role });
  if (!note) throw new AppError('not_found', 'Note not found');

  if (file.data.length > config.limits.maxAttachmentBytes) {
    throw new AppError('payload_too_large', 'Attachment exceeds size limit');
  }

  const declaredType = file.contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(declaredType)) {
    throw new AppError('invalid_request', 'File type not allowed');
  }
  const sniffed = sniffMime(file.data);
  if (sniffed && sniffed !== declaredType) {
    throw new AppError('invalid_request', 'File content does not match declared type');
  }

  // Server-generated, opaque storage key. The original client filename is
  // preserved separately and ONLY echoed in Content-Disposition at download.
  const storageName = randomUUID();
  const safeOriginal = sanitizeFilename(file.filename);

  const att = createAttachment({
    noteId: note.id,
    ownerId: user.id,
    storageName,
    originalName: safeOriginal,
    contentType: declaredType,
    sizeBytes: file.data.length,
  }, file.data);

  appendAudit({
    actorId: user.id,
    event: 'attachment.upload',
    outcome: 'allow',
    context: { noteId: note.id, attachmentId: att.id, sizeBytes: att.sizeBytes, requestId },
  });

  created(res, attachmentView(att), requestId);
});

async function readBody(req: VercelRequest, max: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let aborted = false;
    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > max) {
        aborted = true;
        reject(new AppError('payload_too_large', 'Upload exceeds size limit'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!aborted) resolve(Buffer.concat(chunks)); });
    req.on('error', (err) => { if (!aborted) reject(err); });
  });
}

/**
 * Minimal multipart parser tuned for our two-field form (noteId + file).
 *
 * Boundary defensiveness: parts are delimited by `--<boundary>` (CRLF before
 * and after); the trailing boundary is `--<boundary>--`. We do not assume
 * field order. Names with extra parameters are tolerated.
 */
function parseMultipart(buf: Buffer, boundary: string): MultipartParts {
  const delim = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  let file: MultipartParts['file'] = null;

  // Split on boundary; first chunk is preamble (ignored), last is epilogue.
  const parts: Buffer[] = [];
  let cursor = 0;
  while (cursor < buf.length) {
    const idx = buf.indexOf(delim, cursor);
    if (idx === -1) break;
    if (cursor !== idx) parts.push(buf.subarray(cursor, idx));
    cursor = idx + delim.length;
  }

  for (const part of parts) {
    // Trim leading CRLF and trailing CRLF (the boundary always carries CRLF).
    let p = part;
    if (p.length >= 2 && p[0] === 0x0d && p[1] === 0x0a) p = p.subarray(2);
    if (p.length >= 2 && p[p.length - 2] === 0x0d && p[p.length - 1] === 0x0a) p = p.subarray(0, p.length - 2);
    if (p.length === 0 || p.equals(Buffer.from('--'))) continue;

    const headerEnd = p.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const rawHeaders = p.subarray(0, headerEnd).toString('utf8');
    const body = p.subarray(headerEnd + 4);

    const headers = parseHeaders(rawHeaders);
    const disp = headers['content-disposition'];
    if (!disp) continue;
    const name = /name="([^"]*)"/i.exec(disp)?.[1];
    const filename = /filename="([^"]*)"/i.exec(disp)?.[1];
    if (!name) continue;

    if (filename) {
      file = {
        filename,
        contentType: headers['content-type'] ?? 'application/octet-stream',
        data: body,
      };
    } else {
      fields[name] = body.toString('utf8');
    }
  }
  return { fields, file };
}

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split('\r\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    out[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return out;
}

/**
 * Reduce a client-supplied filename to its basename and remove characters
 * that would be problematic in a Content-Disposition header or a filesystem.
 */
function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[^A-Za-z0-9 ._-]/g, '_').slice(0, 128);
  return cleaned.length === 0 ? 'attachment' : cleaned;
}

/**
 * Magic-byte sniffing for common types. Returns null when we don't recognize
 * the prefix; callers can decide how strict to be.
 */
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 8) {
    if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG') return 'image/png';
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
    if (buf.subarray(0, 6).toString() === 'GIF87a' || buf.subarray(0, 6).toString() === 'GIF89a') return 'image/gif';
    if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  }
  return null;
}
