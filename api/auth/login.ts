import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handleCors, applySecurityHeaders, checkRateLimit } from '../_lib/cors.js';
import { userStore } from '../_lib/store.js';
import { signToken, setAuthCookie } from '../_lib/auth.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';

// ASVS V2.1, V2.2 (Authentication), V11.1 (Brute Force)
const loginSchema = z.object({
  username: z.string().min(1).max(30),
  password: z.string().min(1).max(128),
});

// Generic error message — prevents username enumeration (ASVS V2.2)
const AUTH_FAILURE_MSG = 'Invalid username or password';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`login:${ip}`)) {
    res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } });
    return;
  }

  const body = parseBody(req.body, loginSchema, res);
  if (!body) return;

  const user = userStore.findByUsername(body.username);

  // Always run bcrypt.compare to prevent timing attacks (ASVS V2.2)
  const hashToCompare = user?.passwordHash ?? '$2a$12$invalidhashfortimingconstancy00000000000000000';
  const passwordMatch = await bcrypt.compare(body.password, hashToCompare);

  if (!user || !passwordMatch) {
    audit({ userId: user?.id ?? null, action: 'user.login_failed', resourceType: 'user', outcome: 'failure', details: 'invalid_credentials', req });
    res.status(401).json({ ok: false, error: { code: 'AUTH_FAILED', message: AUTH_FAILURE_MSG } });
    return;
  }

  const token = await signToken({ userId: user.id, username: user.username, role: user.role });
  setAuthCookie(res, token);

  audit({ userId: user.id, username: user.username, action: 'user.login', resourceType: 'user', resourceId: user.id, outcome: 'success', req });

  res.status(200).json({
    ok: true,
    data: {
      user: { id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt, noteCount: user.noteCount },
      token,
    },
  });
}
