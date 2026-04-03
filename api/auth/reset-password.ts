/**
 * POST /api/auth/reset-password
 *
 * Step 2 of password recovery: verify security answer + reset token,
 * then update password if both match.
 *
 * SSEM enforcements:
 * - Confidentiality: current password is NEVER returned to client (PRD §4.3 required this)
 * - Integrity: server-side token consumed atomically; answer verified against hash
 * - Availability: rate-limited; token expires after 30 minutes
 * - Accountability: password resets logged
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ResetPasswordSchema } from '../_lib/validation.js';
import { userRepo, resetTokenRepo } from '../_lib/db.js';
import { verifySecurityAnswer, hashPassword } from '../_lib/crypto.js';
import { checkRateLimit, RATE_LIMITS } from '../_lib/rateLimit.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'POST required' });
  }

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? 'unknown';
  const rateLimitResult = checkRateLimit(`reset-password:${ip}`, RATE_LIMITS.PASSWORD_RECOVERY);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again later.' });
  }

  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
  }
  const { token, securityAnswer, newPassword } = parsed.data;

  // Consume the token (single-use, time-limited)
  const resetRecord = resetTokenRepo.consume(token);
  if (!resetRecord) {
    logger.warn('auth.reset_password.invalid_token', { ip });
    return res.status(400).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' });
  }

  const user = userRepo.findById(resetRecord.userId);
  if (!user) {
    return res.status(400).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' });
  }

  // Verify security answer against the stored hash
  const answerValid = await verifySecurityAnswer(securityAnswer, user.securityAnswerHash);
  if (!answerValid) {
    logger.audit('auth.reset_password.answer_wrong', {
      action: 'reset_password',
      userId: user.id,
      ip,
      outcome: 'failure',
    });
    return res.status(400).json({ code: 'WRONG_ANSWER', message: 'Incorrect security answer' });
  }

  const newHash = await hashPassword(newPassword);
  userRepo.update(user.id, { passwordHash: newHash });

  logger.audit('auth.reset_password.success', {
    action: 'reset_password',
    userId: user.id,
    ip,
    outcome: 'success',
  });

  // Password is NOT returned. User must log in with the new password.
  return res.status(200).json({ message: 'Password updated successfully. Please log in.' });
}
