// Shared helpers for note response building — Analyzability (DRY, single responsibility)
import type { NoteRecord, RatingRecord, AttachmentRecord } from '../_lib/types.js';
import type { userStore as UserStoreType } from '../_lib/store.js';

type UserStore = typeof UserStoreType;

/** Build a NoteListItem from raw store records. */
export function buildNoteListItem(
  note: NoteRecord,
  noteRatings: RatingRecord[],
  uStore: UserStore
) {
  const owner = uStore.findById(note.ownerId);
  const avg = computeAverage(noteRatings);
  return {
    id: note.id,
    title: note.title,
    excerpt: note.content.slice(0, 200),
    visibility: note.visibility,
    ownerId: note.ownerId,
    ownerUsername: owner?.username ?? 'unknown',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    averageRating: avg,
    ratingCount: noteRatings.length,
  };
}

/** Build a full Note detail object from raw store records. */
export function buildNoteDetail(
  note: NoteRecord,
  noteRatings: RatingRecord[],
  noteAttachments: AttachmentRecord[],
  uStore: UserStore
) {
  const owner = uStore.findById(note.ownerId);
  const avg = computeAverage(noteRatings);

  const ratings = noteRatings.map((r) => {
    const ratingUser = uStore.findById(r.userId);
    return {
      id: r.id,
      noteId: r.noteId,
      userId: r.userId,
      username: ratingUser?.username ?? 'unknown',
      value: r.value,
      comment: r.comment,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });

  return {
    id: note.id,
    title: note.title,
    content: note.content,
    visibility: note.visibility,
    ownerId: note.ownerId,
    ownerUsername: owner?.username ?? 'unknown',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    attachments: noteAttachments,
    ratings: ratings.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    averageRating: avg,
    ratingCount: noteRatings.length,
  };
}

function computeAverage(ratings: RatingRecord[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r.value, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}
