/**
 * GET /api/users/autocomplete?prefix=... — email prefix autocomplete.
 *
 * FIASSE rejections from PRD §15:
 *  - "Accessible without authentication": REJECTED — requires session.
 *  - "Pass the partial-email value directly to the data access layer
 *    without modification" / "concatenation into a pattern-match filter
 *    clause without parameterisation": REJECTED — the prefix is a
 *    schema-validated string and the filter is a typed predicate.
 *  - "No rate limiting": REJECTED — per-user token bucket.
 *  - "Return all matching email addresses": REJECTED — we return only
 *    suggestions the caller is permitted to see and limit response size.
 *    Returning every email address platform-wide is an enumeration oracle
 *    that violates Confidentiality (S3.2.2.1).
 *
 * For this implementation we restrict suggestions to users who have public
 * notes (i.e., have already revealed they exist) — minimizing the
 * information surface relative to "every account on the platform".
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handler, readQuery, ok } from '../_lib/request.js';
import { EmailLookupSchema } from '../_lib/schemas.js';
import { listUsers, listNotesForOwner } from '../_lib/db.js';
import {
  requireMethod, requireUser,
} from '../_lib/auth.js';
import { consume, limits } from '../_lib/ratelimit.js';

export default handler(async (req: VercelRequest, res: VercelResponse, { requestId }) => {
  requireMethod(req, res, ['GET']);
  const user = await requireUser(req);
  consume(`emailLookup:${user.id}`, limits.emailLookup);

  const q = readQuery(req, EmailLookupSchema);
  const prefix = q.prefix.toLowerCase();

  const visible = listUsers().filter((u) => {
    if (!u.email.toLowerCase().startsWith(prefix)) return false;
    if (u.id === user.id) return true;
    // Reveal only users with at least one public note — minimizes
    // user-enumeration surface.
    return listNotesForOwner(u.id).some((n) => n.isPublic);
  }).slice(0, 10);

  ok(res, {
    suggestions: visible.map((u) => ({ email: u.email, username: u.username })),
  }, requestId);
});
