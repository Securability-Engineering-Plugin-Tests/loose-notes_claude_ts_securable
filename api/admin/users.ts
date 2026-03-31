import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/auth.js';
import { userStore } from '../_lib/store.js';
import { audit } from '../_lib/audit.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required' } });
    return;
  }

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const searchQuery = typeof req.query.q === 'string' ? req.query.q.toLowerCase().slice(0, 200) : '';

  const users = userStore.list()
    .filter((u) => {
      if (!searchQuery) return true;
      return u.username.toLowerCase().includes(searchQuery) || u.email.toLowerCase().includes(searchQuery);
    })
    .map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      noteCount: u.noteCount,
    })); // passwordHash excluded (Confidentiality)

  audit({ userId: ctx.userId, username: ctx.username, action: 'admin.view_users', resourceType: 'user', outcome: 'success', req });

  res.status(200).json({ ok: true, data: users });
}
