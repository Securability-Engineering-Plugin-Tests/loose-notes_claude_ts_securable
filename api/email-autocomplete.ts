/**
 * GET /api/email-autocomplete?q=partial
 *
 * SSEM enforcements:
 * - Authenticity: requires authentication (PRD §15.2 required anonymous access)
 * - Integrity: parameterised prefix query (PRD §15.2 required concatenation)
 * - Availability: rate-limited; results capped
 * - Confidentiality: returns only email addresses the caller is permitted to see
 *
 * PRD §15.2 required this endpoint to be unauthenticated and use raw concatenation.
 * Both are corrected.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth.js';
import { userRepo } from './_lib/db.js';
import { AutocompleteSchema } from './_lib/validation.js';
import { checkRateLimit, RATE_LIMITS } from './_lib/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET required' });
  }

  // Authentication required — PRD §15.2 explicitly required none
  const claims = await requireAuth(req, res);
  if (!claims) return;

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`autocomplete:${ip}`, RATE_LIMITS.AUTOCOMPLETE).allowed) {
    return res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' });
  }

  const parsed = AutocompleteSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
  }

  // Typed predicate search — not string concatenation
  const matches = userRepo
    .searchByEmailPrefix(parsed.data.q)
    .slice(0, 10)           // Cap results at 10
    .map(u => u.email);

  return res.status(200).json(matches);
}
