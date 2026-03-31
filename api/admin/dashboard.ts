import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { requireAdmin } from '../_lib/auth.js';
import { userStore, noteStore, ratingStore, auditStore } from '../_lib/store.js';
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

  audit({ userId: ctx.userId, username: ctx.username, action: 'admin.view_users', resourceType: 'admin', outcome: 'success', req });

  const allNotes = noteStore.list();
  const allRatings: ReturnType<typeof ratingStore.findByNoteId> = [];
  for (const note of allNotes) {
    allRatings.push(...ratingStore.findByNoteId(note.id));
  }

  // Build notes-by-day histogram (last 30 days) for Recharts
  const notesByDay = buildNotesByDay(allNotes);
  const ratingDistribution = buildRatingDistribution(allRatings);

  const stats = {
    totalUsers: userStore.list().length,
    totalNotes: allNotes.length,
    publicNoteCount: allNotes.filter((n) => n.visibility === 'public').length,
    privateNoteCount: allNotes.filter((n) => n.visibility === 'private').length,
    totalRatings: allRatings.length,
    recentAuditLogs: auditStore.recent(20),
    notesByDay,
    ratingDistribution,
  };

  res.status(200).json({ ok: true, data: stats });
}

function buildNotesByDay(notes: Array<{ createdAt: string }>): Array<{ date: string; count: number }> {
  const map = new Map<string, number>();
  const now = new Date();
  // Initialize last 14 days with 0
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const n of notes) {
    const day = n.createdAt.slice(0, 10);
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

function buildRatingDistribution(ratings: Array<{ value: number }>): Array<{ value: number; count: number }> {
  const dist = [1, 2, 3, 4, 5].map((v) => ({ value: v, count: 0 }));
  for (const r of ratings) {
    const entry = dist.find((d) => d.value === r.value);
    if (entry) entry.count += 1;
  }
  return dist;
}
