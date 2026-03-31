import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { userStore, resetTokenStore } from '../_lib/store.js';
import { parseBody } from '../_lib/validate.js';
import { audit } from '../_lib/audit.js';

const resetSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } });
    return;
  }

  const body = parseBody(req.body, resetSchema, res);
  if (!body) return;

  const tokenRecord = resetTokenStore.find(body.token);

  if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < Date.now()) {
    // Generic message to avoid token validity enumeration
    res.status(400).json({ ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' } });
    return;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  userStore.update(tokenRecord.userId, { passwordHash });
  resetTokenStore.invalidate(body.token);

  audit({ userId: tokenRecord.userId, action: 'user.password_reset_complete', resourceType: 'user', resourceId: tokenRecord.userId, outcome: 'success', req });

  res.status(200).json({ ok: true, data: { message: 'Password reset successfully' } });
}
