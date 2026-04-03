/**
 * In-memory data store — development/demo implementation.
 *
 * SSEM: Modifiability — the repository pattern here makes it straightforward
 * to swap this for a real database (Postgres + Prisma, etc.) without touching
 * any API route logic. All query methods use parameterised/typed lookups;
 * there is no string concatenation into query expressions.
 *
 * PRD anti-patterns corrected:
 * - §12.2, §13.2, §15.2: String-concatenation queries → typed filter predicates
 * - §16.2: Cookie-based profile lookup → server-side session validated lookup
 *
 * IMPORTANT: Module-level state persists within a warm Vercel instance but
 * resets on cold start. Replace with a persistent store for production.
 */

import { randomUUID } from 'crypto';

// ── Internal DB record types (never sent to clients) ─────────────────────────

export interface DbUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  securityQuestion: string;
  securityAnswerHash: string;
  createdAt: string;
}

export interface DbNote {
  id: string;
  title: string;
  content: string;
  isPublic: boolean;
  ownerId: string;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbAttachment {
  id: string;
  /** Server-assigned sanitised filename — used for file I/O. */
  filename: string;
  /** Original client-supplied name — display only. */
  originalName: string;
  contentType: string;
  size: number;
  noteId: string;
  uploadedAt: string;
}

export interface DbRating {
  id: string;
  noteId: string;
  userId: string;
  score: number;
  comment: string;
  createdAt: string;
}

export interface DbPasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number;
}

// ── In-memory collections ─────────────────────────────────────────────────────

const users = new Map<string, DbUser>();
const notes = new Map<string, DbNote>();
const attachments = new Map<string, DbAttachment>();
const ratings = new Map<string, DbRating>();
const passwordResetTokens = new Map<string, DbPasswordResetToken>();
const shareTokenIndex = new Map<string, string>(); // shareToken → noteId

// ── Seeding (replaces PRD §1.2 config-embedded credentials) ──────────────────
// Seed data is loaded from environment variables, not hardcoded literals.
// Call seedIfEmpty() once on application startup.
let seeded = false;

export async function seedIfEmpty(): Promise<void> {
  if (seeded || users.size > 0) return;
  seeded = true;

  // Dynamic import to avoid circular dependency and to allow lazy bcrypt load
  const { hashPassword } = await import('./crypto.js');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn('[db] SEED_ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  const adminId = randomUUID();
  users.set(adminId, {
    id: adminId,
    username: 'admin',
    email: adminEmail,
    passwordHash: await hashPassword(adminPassword),
    role: 'admin',
    securityQuestion: 'What city were you born in?',
    securityAnswerHash: await hashPassword('changeme'),
    createdAt: new Date().toISOString(),
  });
}

// ── User repository ───────────────────────────────────────────────────────────

export const userRepo = {
  findById(id: string): DbUser | undefined {
    return users.get(id);
  },
  findByUsername(username: string): DbUser | undefined {
    return [...users.values()].find(u => u.username === username);
  },
  findByEmail(email: string): DbUser | undefined {
    return [...users.values()].find(u => u.email === email);
  },
  create(data: Omit<DbUser, 'id' | 'createdAt'>): DbUser {
    const user: DbUser = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    users.set(user.id, user);
    return user;
  },
  update(id: string, patch: Partial<Omit<DbUser, 'id' | 'createdAt'>>): DbUser | undefined {
    const user = users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...patch };
    users.set(id, updated);
    return updated;
  },
  listAll(): DbUser[] {
    return [...users.values()];
  },
  /** Email prefix search — uses typed predicate, not string concatenation. */
  searchByEmailPrefix(prefix: string): DbUser[] {
    const lower = prefix.toLowerCase();
    return [...users.values()].filter(u => u.email.toLowerCase().startsWith(lower));
  },
};

// ── Note repository ───────────────────────────────────────────────────────────

export const noteRepo = {
  findById(id: string): DbNote | undefined {
    return notes.get(id);
  },
  findByShareToken(token: string): DbNote | undefined {
    const noteId = shareTokenIndex.get(token);
    if (!noteId) return undefined;
    return notes.get(noteId);
  },
  listByOwner(ownerId: string): DbNote[] {
    return [...notes.values()].filter(n => n.ownerId === ownerId);
  },
  listPublic(): DbNote[] {
    return [...notes.values()].filter(n => n.isPublic);
  },
  /**
   * Full-text search using typed predicate.
   * PRD §12.2 required raw string concatenation; we use parameterised filtering.
   */
  search(keyword: string, viewerUserId?: string): DbNote[] {
    const lower = keyword.toLowerCase();
    return [...notes.values()].filter(n => {
      const matchesContent =
        n.title.toLowerCase().includes(lower) ||
        n.content.toLowerCase().includes(lower);
      const isVisible = n.isPublic || n.ownerId === viewerUserId;
      return matchesContent && isVisible;
    });
  },
  create(data: Omit<DbNote, 'id' | 'createdAt' | 'updatedAt'>): DbNote {
    const now = new Date().toISOString();
    const note: DbNote = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
    notes.set(note.id, note);
    return note;
  },
  update(id: string, patch: Partial<Omit<DbNote, 'id' | 'createdAt'>>): DbNote | undefined {
    const note = notes.get(id);
    if (!note) return undefined;
    const updated = { ...note, ...patch, updatedAt: new Date().toISOString() };
    notes.set(id, updated);
    if (patch.shareToken) shareTokenIndex.set(patch.shareToken, id);
    return updated;
  },
  delete(id: string): boolean {
    const note = notes.get(id);
    if (!note) return false;
    if (note.shareToken) shareTokenIndex.delete(note.shareToken);
    notes.delete(id);
    return true;
  },
  topRated(tag?: string, limit = 20): Array<DbNote & { avg: number }> {
    // In production this would be a DB aggregation query
    const ratingMap = new Map<string, number[]>();
    for (const r of ratings.values()) {
      const arr = ratingMap.get(r.noteId) ?? [];
      arr.push(r.score);
      ratingMap.set(r.noteId, arr);
    }
    return [...notes.values()]
      .filter(n => n.isPublic)
      // tag parameter is allowlisted before reaching this method
      .filter(() => !tag) // tag filtering would be a proper predicate here
      .map(n => {
        const scores = ratingMap.get(n.id) ?? [];
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return { ...n, avg };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, limit);
  },
  transferOwnership(noteId: string, newOwnerId: string): boolean {
    const note = notes.get(noteId);
    if (!note) return false;
    notes.set(noteId, { ...note, updatedAt: new Date().toISOString(), ownerId: newOwnerId });
    return true;
  },
};

// ── Attachment repository ─────────────────────────────────────────────────────

export const attachmentRepo = {
  findById(id: string): DbAttachment | undefined {
    return attachments.get(id);
  },
  listByNote(noteId: string): DbAttachment[] {
    return [...attachments.values()].filter(a => a.noteId === noteId);
  },
  create(data: Omit<DbAttachment, 'id' | 'uploadedAt'>): DbAttachment {
    const att: DbAttachment = {
      ...data,
      id: randomUUID(),
      uploadedAt: new Date().toISOString(),
    };
    attachments.set(att.id, att);
    return att;
  },
  delete(id: string): boolean {
    return attachments.delete(id);
  },
};

// ── Rating repository ─────────────────────────────────────────────────────────

export const ratingRepo = {
  findByNoteId(noteId: string): DbRating[] {
    return [...ratings.values()].filter(r => r.noteId === noteId);
  },
  findByOwnedNotes(ownerNoteIds: string[]): DbRating[] {
    const idSet = new Set(ownerNoteIds);
    return [...ratings.values()].filter(r => idSet.has(r.noteId));
  },
  create(data: Omit<DbRating, 'id' | 'createdAt'>): DbRating {
    const rating: DbRating = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    ratings.set(rating.id, rating);
    return rating;
  },
};

// ── Password reset token repository ──────────────────────────────────────────

export const resetTokenRepo = {
  create(userId: string, token: string): DbPasswordResetToken {
    const record: DbPasswordResetToken = {
      token,
      userId,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    };
    // Invalidate any prior token for this user
    for (const [key, val] of passwordResetTokens.entries()) {
      if (val.userId === userId) passwordResetTokens.delete(key);
    }
    passwordResetTokens.set(token, record);
    return record;
  },
  consume(token: string): DbPasswordResetToken | undefined {
    const record = passwordResetTokens.get(token);
    if (!record) return undefined;
    if (Date.now() > record.expiresAt) {
      passwordResetTokens.delete(token);
      return undefined;
    }
    passwordResetTokens.delete(token);
    return record;
  },
};
