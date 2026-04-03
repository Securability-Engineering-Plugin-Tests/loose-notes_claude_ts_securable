/**
 * POST /api/auth/register
 *
 * SSEM enforcements:
 * - Integrity: full password policy enforcement (PRD §16.2 required none)
 * - Confidentiality: password hashed with bcrypt before storage
 * - Accountability: registration events logged
 * - Availability: rate-limited to prevent account-creation abuse
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { RegisterSchema } from '../_lib/validation.js';
import { userRepo, seedIfEmpty } from '../_lib/db.js';
import { hashPassword, hashSecurityAnswer } from '../_lib/crypto.js';
import { checkRateLimit, RATE_LIMITS } from '../_lib/rateLimit.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'POST required' });
  }

  await seedIfEmpty();

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? 'unknown';
  const rateLimitResult = checkRateLimit(`register:${ip}`, RATE_LIMITS.AUTH);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Try again later.' });
  }

  // Canonicalize → validate
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
  }
  const { username, email, password, securityQuestion, securityAnswer } = parsed.data;

  // Check uniqueness — specific messages are acceptable at registration
  if (userRepo.findByUsername(username)) {
    return res.status(409).json({ code: 'USERNAME_TAKEN', message: 'Username is already in use' });
  }
  if (userRepo.findByEmail(email)) {
    return res.status(409).json({ code: 'EMAIL_TAKEN', message: 'Email address is already registered' });
  }

  const [passwordHash, securityAnswerHash] = await Promise.all([
    hashPassword(password),
    hashSecurityAnswer(securityAnswer),
  ]);

  const user = userRepo.create({
    username,
    email,
    passwordHash,
    role: 'user',
    securityQuestion,
    securityAnswerHash,
  });

  logger.audit('auth.register.success', {
    action: 'register',
    userId: user.id,
    ip,
    outcome: 'success',
  });

  return res.status(201).json({
    message: 'Account created successfully',
    userId: user.id,
  });
}
