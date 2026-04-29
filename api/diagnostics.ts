/**
 * GET /api/diagnostics — request introspection (admin only).
 *
 * FIASSE rejections from PRD §25:
 *  - "Display all HTTP request header name-value pairs": REJECTED. We strip
 *    Authorization, Cookie, and any Set-Cookie value; these would leak
 *    session credentials to anyone with access to the page output.
 *  - "Replace ampersands with <br>" / "assign directly to the output control
 *    without applying HTML encoding": REJECTED. We return JSON; the client
 *    renders the values via React, which escapes by default.
 *  - PRD §18.2 + §25 implies diagnostics are accessible to any authenticated
 *    user. REJECTED — diagnostics are admin-only since the data is operational.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, ok } from '../_lib/request.js';
import { requireMethod, requireAdmin } from '../_lib/auth.js';
import { config } from '../_lib/config.js';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-vercel-deployment-url',
  'x-real-ip',
  'x-forwarded-for',
]);

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['GET']);
  await requireAdmin(req);

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    const k = name.toLowerCase();
    if (SENSITIVE_HEADERS.has(k)) {
      headers[k] = '[redacted]';
    } else {
      headers[k] = Array.isArray(value) ? value.join(', ') : (value ?? '');
    }
  }

  ok(res, {
    method: req.method,
    path: req.url,
    headers,
    runtime: {
      node: process.version,
      production: config.isProduction,
      cookieSecure: config.cookieSecure,
      allowedOrigins: config.allowedOrigins,
    },
    requestId,
  }, requestId);
});
