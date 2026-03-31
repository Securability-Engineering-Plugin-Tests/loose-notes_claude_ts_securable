import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { userStore } from '../_lib/store.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required' } });
    return;
  }

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const user = userStore.findById(ctx.userId);
  if (!user) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  // Return only public fields — passwordHash never included (Confidentiality)
  res.status(200).json({
    ok: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      noteCount: user.noteCount,
    },
  });
}
