import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, applySecurityHeaders } from '../_lib/cors.js';
import { noteStore, ratingStore, userStore } from '../_lib/store.js';
import { buildNoteListItem } from './_noteHelpers.js';

const MIN_RATINGS = 3;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;
  applySecurityHeaders(res);

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET required' } });
    return;
  }

  // Only public notes with at least MIN_RATINGS ratings qualify
  const publicNotes = noteStore.list().filter((n) => n.visibility === 'public');

  const qualified = publicNotes
    .map((n) => {
      const noteRatings = ratingStore.findByNoteId(n.id);
      return { note: n, ratings: noteRatings };
    })
    .filter(({ ratings }) => ratings.length >= MIN_RATINGS);

  const sorted = qualified.sort((a, b) => {
    const avgA = a.ratings.reduce((s, r) => s + r.value, 0) / a.ratings.length;
    const avgB = b.ratings.reduce((s, r) => s + r.value, 0) / b.ratings.length;
    return avgB - avgA;
  });

  const items = sorted.slice(0, 20).map(({ note, ratings }) =>
    buildNoteListItem(note, ratings, userStore)
  );

  res.status(200).json({ ok: true, data: items });
}
