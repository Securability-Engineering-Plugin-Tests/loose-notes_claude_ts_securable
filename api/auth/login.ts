/**
 * POST /api/auth/login
 *
 * SSEM enforcements:
 * - Authenticity: bcrypt password verification (not base64 compare, PRD §2.2)
 * - Availability: rate-limited per IP (PRD §2.2 required none)
 * - Accountability: login success/failure logged with structured data
 * - Integrity: input validated with Zod before any DB access
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { LoginSchema } from '../_lib/validation.js';
import { userRepo, seedIfEmpty } from '../_lib/db.js';
import { verifyPassword } from '../_lib/crypto.js';
import { issueSession } from '../_lib/auth.js';
import { checkRateLimit, RATE_LIMITS } from '../_lib/rateLimit.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'POST required' });
  }

  await seedIfEmpty();

  // Rate limit by IP — PRD §2.2 explicitly forbade this; we enforce it
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? 'unknown';
  const rateLimitResult = checkRateLimit(`login:${ip}`, RATE_LIMITS.AUTH);
  if (!rateLimitResult.allowed) {
    logger.warn('auth.login.rate_limited', { ip });
    return res.status(429).json({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again later.',
    });
  }

  // Canonicalize → validate input at trust boundary
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
  }
  const { username, password } = parsed.data;

  const user = userRepo.findByUsername(username);

  // Use constant-time comparison path regardless of whether user exists
  // to prevent username enumeration via timing
  const passwordValid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, '$2b$12$invalidhashinvalidhashinvalidhashinvalid');

  if (!user || !passwordValid) {
    logger.audit('auth.login.failed', {
      action: 'login',
      username,
      ip,
      outcome: 'failure',
    });
    // Generic error — do not disclose whether username or password is wrong
    return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' });
  }

  const csrfToken = await issueSession(res, user.id, user.username, user.role);

  logger.audit('auth.login.success', {
    action: 'login',
    userId: user.id,
    ip,
    outcome: 'success',
  });

  return res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    csrfToken,
  });
}
