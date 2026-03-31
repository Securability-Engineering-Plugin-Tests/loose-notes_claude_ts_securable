import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { handleCors, applySecurityHeaders, checkRateLimit } from '../_lib/cors.js';
import { userStore, resetTokenStore } from '../_lib/store.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';

const forgotSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
});

// Token valid for 1 hour (ASVS V2.3)
const TOKEN_TTL_MS = 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`forgot:${ip}`)) {
    res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    return;
  }

  const body = parseBody(req.body, forgotSchema, res);
  if (!body) return;

  // Always return success — prevents email enumeration (ASVS V2.3)
  const SUCCESS_RESPONSE = { ok: true, data: { message: 'If that email exists, a reset link was sent.' } };

  const user = userStore.findByEmail(body.email);
  if (!user) {
    res.status(200).json(SUCCESS_RESPONSE);
    return;
  }

  const token = randomBytes(32).toString('hex');
  resetTokenStore.save({ token, userId: user.id, expiresAt: Date.now() + TOKEN_TTL_MS, used: false });

  // In production: send email. For demo, log the token (NEVER in prod).
  if (process.env.NODE_ENV !== 'production') {
    console.info(JSON.stringify({ event: 'demo_reset_token', token, userId: user.id }));
  }

  audit({ userId: user.id, action: 'user.password_reset_request', resourceType: 'user', resourceId: user.id, outcome: 'success', req });

  res.status(200).json(SUCCESS_RESPONSE);
}
