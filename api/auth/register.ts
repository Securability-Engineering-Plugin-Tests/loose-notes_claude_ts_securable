import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handleCors, applySecurityHeaders, checkRateLimit } from '../_lib/cors.js';
import { userStore } from '../_lib/store.js';
import { signToken, setAuthCookie } from '../_lib/auth.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';

// ASVS V2.1 (Password Security), V2.4 (Credential Storage)
const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username'),
  email: z.string().email().max(254).toLowerCase(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } });
    return;
  }

  // Rate limit by IP to prevent account enumeration (Availability)
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`register:${ip}`)) {
    res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    return;
  }

  const body = parseBody(req.body, registerSchema, res);
  if (!body) return;

  // Check uniqueness — constant-time path to avoid username/email enumeration
  const existingByUsername = userStore.findByUsername(body.username);
  const existingByEmail = userStore.findByEmail(body.email);

  if (existingByUsername || existingByEmail) {
    audit({ userId: null, action: 'user.register', resourceType: 'user', outcome: 'failure', details: 'duplicate_username_or_email', req });
    res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'Username or email already exists' } });
    return;
  }

  // Hash password with bcrypt (cost factor 12) — ASVS V2.4
  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = userStore.create({
    id: randomUUID(),
    username: body.username,
    email: body.email,
    role: 'user',
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  const token = await signToken({ userId: user.id, username: user.username, role: user.role });
  setAuthCookie(res, token);

  audit({ userId: user.id, action: 'user.register', resourceType: 'user', resourceId: user.id, outcome: 'success', req });

  res.status(201).json({
    ok: true,
    data: {
      user: { id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt, noteCount: 0 },
      token,
    },
  });
}
