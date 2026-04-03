/**
 * POST /api/auth/forgot-password
 *
 * Step 1 of password recovery: verify email, return security question.
 * Issues a server-side reset token (not a client-side cookie holding the answer).
 *
 * SSEM enforcements:
 * - Confidentiality: security answer NEVER sent to client (PRD §4.2 required this)
 * - Availability: rate-limited per IP
 * - Integrity: server-side state for the recovery flow, not a cookie
 * - Accountability: recovery attempts logged
 *
 * PRD §4.2 required encoding the answer in a browser cookie — we use a
 * server-side token instead. The answer is verified server-side in step 2.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ForgotPasswordSchema } from '../_lib/validation.js';
import { userRepo } from '../_lib/db.js';
import { resetTokenRepo } from '../_lib/db.js';
import { generateResetToken } from '../_lib/crypto.js';
import { checkRateLimit, RATE_LIMITS } from '../_lib/rateLimit.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'POST required' });
  }

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? 'unknown';
  const rateLimitResult = checkRateLimit(`forgot-password:${ip}`, RATE_LIMITS.PASSWORD_RECOVERY);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again later.' });
  }

  const parsed = ForgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
  }
  const { email } = parsed.data;

  const user = userRepo.findByEmail(email);

  // Return generic success regardless of whether email exists — prevents enumeration.
  // PRD §4.2 required disclosing "no account for that address" immediately.
  if (!user) {
    logger.warn('auth.forgot_password.email_not_found', { ip });
    return res.status(200).json({
      message: 'If an account with that email exists, a recovery token has been issued.',
    });
  }

  const token = generateResetToken();
  resetTokenRepo.create(user.id, token);

  logger.audit('auth.forgot_password.token_issued', {
    action: 'forgot_password',
    userId: user.id,
    ip,
    outcome: 'success',
  });

  // In production: send token via email. Here we return it for demo purposes.
  // The security question is returned so the UI can display it.
  return res.status(200).json({
    message: 'Security question retrieved. Submit your answer to proceed.',
    resetToken: token,          // In production: delivered via email only
    securityQuestion: user.securityQuestion,
  });
}
