/**
 * GET  /api/profile  — Get profile of authenticated user
 * PUT  /api/profile  — Update profile (email, password)
 *
 * SSEM enforcements:
 * - Integrity: user identified from JWT (not a cookie value passed to DB, PRD §16.2)
 * - Confidentiality: password hash never returned; current password verified before change
 * - Accountability: profile updates logged
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireCsrf } from '../_lib/auth.js';
import { userRepo } from '../_lib/db.js';
import { UpdateProfileSchema } from '../_lib/validation.js';
import { verifyPassword, hashPassword } from '../_lib/crypto.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // User identity comes from verified JWT — not a client-supplied cookie value
  const claims = await requireAuth(req, res);
  if (!claims) return;

  if (req.method === 'GET') {
    const user = userRepo.findById(claims.sub);
    if (!user) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    // Return only fields the client needs — no passwordHash, no securityAnswerHash
    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      securityQuestion: user.securityQuestion,
    });
  }

  if (req.method === 'PUT') {
    if (!requireCsrf(req, res)) return;

    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message });
    }
    const { email, currentPassword, newPassword } = parsed.data;

    const user = userRepo.findById(claims.sub);
    if (!user) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    // Always verify current password before any profile change
    const currentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentValid) {
      logger.audit('profile.update.wrong_password', {
        action: 'update_profile',
        userId: claims.sub,
        outcome: 'failure',
      });
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' });
    }

    const patch: Record<string, string> = {};
    if (email && email !== user.email) {
      if (userRepo.findByEmail(email)) {
        return res.status(409).json({ code: 'EMAIL_TAKEN', message: 'Email is already in use' });
      }
      patch.email = email;
    }
    if (newPassword) {
      patch.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(patch).length > 0) {
      userRepo.update(claims.sub, patch);
      logger.audit('profile.updated', {
        action: 'update_profile',
        userId: claims.sub,
        fields: Object.keys(patch).join(','),
        outcome: 'success',
      });
    }

    return res.status(200).json({ message: 'Profile updated successfully' });
  }

  return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'GET or PUT required' });
}
