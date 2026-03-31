import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAuth, clearAuthCookie } from '../_lib/auth.js';
import { audit } from '../_lib/audit.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } });
    return;
  }

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  clearAuthCookie(res);
  audit({ userId: ctx.userId, username: ctx.username, action: 'user.logout', resourceType: 'user', resourceId: ctx.userId, outcome: 'success', req });

  res.status(200).json({ ok: true, data: { message: 'Logged out successfully' } });
}
