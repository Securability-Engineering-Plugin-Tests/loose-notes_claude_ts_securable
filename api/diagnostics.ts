/**
 * GET /api/diagnostics
 *
 * Request diagnostics page for authenticated users.
 *
 * SSEM enforcements:
 * - Integrity: header values are HTML-encoded before insertion (PRD §25.2 required none)
 * - Confidentiality: sensitive headers (Authorization, Cookie) are redacted
 * - Authenticity: requires authentication
 *
 * PRD §25.2 required replacing '&' with '<br>' and assigning raw header values
 * directly to output — a reflected XSS vector. We encode all output here.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth.js';

/** Headers that must never be reflected in diagnostics output. */
const REDACTED_HEADERS = new Set(['authorization', 'cookie', 'x-csrf-token', 'x-api-key']);

function htmlEncode(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET required' });
  }

  const claims = await requireAuth(req, res);
  if (!claims) return;

  // Build safe header map — redact sensitive headers, encode all values
  const safeHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (REDACTED_HEADERS.has(name.toLowerCase())) {
      safeHeaders[name] = '[REDACTED]';
    } else {
      // Encode the value before including it in any output
      safeHeaders[name] = htmlEncode(String(value ?? ''));
    }
  }

  // Return as structured JSON — rendering/display is the frontend's responsibility
  // The frontend must use React's default escaping (JSX), not dangerouslySetInnerHTML
  return res.status(200).json({
    method: req.method,
    url: req.url,
    headers: safeHeaders,
    timestamp: new Date().toISOString(),
  });
}
