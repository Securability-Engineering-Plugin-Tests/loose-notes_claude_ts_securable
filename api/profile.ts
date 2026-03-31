import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handleCors, applySecurityHeaders } from './_lib/cors.js';
import { requireAuth } from './_lib/auth.js';
import { userStore } from './_lib/store.js';
import { parseBody } from './_lib/validate.js';
import { audit } from './_lib/audit.js';

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().max(254).toLowerCase(),
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(8).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).optional(),
}).refine((d) => !(d.newPassword && !d.currentPassword), {
  message: 'Current password required to set new password',
  path: ['currentPassword'],
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  if (req.method === 'GET') {
    return handleGet(ctx.userId, res);
  }

  if (req.method === 'PUT') {
    return handlePut(req, res, ctx.userId);
  }

  res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET or PUT required' } });
}

async function handleGet(userId: string, res: VercelResponse): Promise<void> {
  const user = userStore.findById(userId);
  if (!user) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  res.status(200).json({
    ok: true,
    data: { id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt, noteCount: user.noteCount },
  });
}

async function handlePut(req: VercelRequest, res: VercelResponse, userId: string): Promise<void> {
  const body = parseBody(req.body, updateProfileSchema, res);
  if (!body) return;

  const user = userStore.findById(userId);
  if (!user) {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  // Verify current password if changing password (Authenticity)
  if (body.newPassword) {
    const match = await bcrypt.compare(body.currentPassword!, user.passwordHash);
    if (!match) {
      res.status(400).json({ ok: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
      return;
    }
  }

  // Check username/email uniqueness (excluding self)
  const existingByUsername = userStore.findByUsername(body.username);
  if (existingByUsername && existingByUsername.id !== userId) {
    res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'Username already taken' } });
    return;
  }

  const patch: Parameters<typeof userStore.update>[1] = { username: body.username, email: body.email };
  if (body.newPassword) {
    patch.passwordHash = await bcrypt.hash(body.newPassword, 12);
  }

  userStore.update(userId, patch);

  audit({ userId, username: body.username, action: 'user.profile_update', resourceType: 'user', resourceId: userId, outcome: 'success', req });

  res.status(200).json({ ok: true, data: { message: 'Profile updated' } });
}
