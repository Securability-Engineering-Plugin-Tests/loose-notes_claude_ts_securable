// In-memory data store — module-level singleton for Vercel serverless
// NOTE: State resets on cold start. For production, replace with a real DB.
// FIASSE: This module is the data access layer — keep business logic out.

import { randomUUID } from 'crypto';
import type {
  UserRecord,
  NoteRecord,
  RatingRecord,
  AttachmentRecord,
  ShareLinkRecord,
  AuditLogRecord,
  PasswordResetToken,
} from './types.js';

// Module-level maps — shared within a warm function instance
const users = new Map<string, UserRecord>();
const notes = new Map<string, NoteRecord>();
const ratings = new Map<string, RatingRecord>();
const attachments = new Map<string, AttachmentRecord>();
const shareLinks = new Map<string, ShareLinkRecord>();
const auditLogs: AuditLogRecord[] = [];
const passwordResetTokens = new Map<string, PasswordResetToken>();

// --- Seed data (demo only) ---
// Passwords are bcrypt hashes. Demo credentials:
//   admin / Admin123!
//   alice / Alice123!
//   bob   / Bob12345!
const SEED_USERS: UserRecord[] = [
  {
    id: 'u-seed-admin',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpR5/m.6z0eAfi',
    createdAt: '2024-01-01T00:00:00Z',
    noteCount: 1,
  },
  {
    id: 'u-seed-alice',
    username: 'alice',
    email: 'alice@example.com',
    role: 'user',
    passwordHash: '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    createdAt: '2024-01-02T00:00:00Z',
    noteCount: 2,
  },
  {
    id: 'u-seed-bob',
    username: 'bob',
    email: 'bob@example.com',
    role: 'user',
    passwordHash: '$2a$12$cfEGHBaH8DFjr0A5GX7dfu.7zC.UGrWz0Kye2pS9T5C5I9PUifDia',
    createdAt: '2024-01-03T00:00:00Z',
    noteCount: 1,
  },
];

const SEED_NOTES: NoteRecord[] = [
  {
    id: 'n-seed-1',
    title: 'Welcome to Loose Notes',
    content: 'This is a demo note showing the public note feature. You can create, edit, and share notes with others.',
    visibility: 'public',
    ownerId: 'u-seed-admin',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
  {
    id: 'n-seed-2',
    title: "Alice's TypeScript Tips",
    content: 'Use strict TypeScript settings to catch type errors early. Enable noImplicitAny and strictNullChecks for best results.',
    visibility: 'public',
    ownerId: 'u-seed-alice',
    createdAt: '2024-01-02T10:00:00Z',
    updatedAt: '2024-01-02T10:00:00Z',
  },
  {
    id: 'n-seed-3',
    title: "Alice's Private Notes",
    content: 'This is a private note only visible to Alice and admins.',
    visibility: 'private',
    ownerId: 'u-seed-alice',
    createdAt: '2024-01-02T12:00:00Z',
    updatedAt: '2024-01-02T12:00:00Z',
  },
  {
    id: 'n-seed-4',
    title: 'Security Best Practices',
    content: 'Always validate input at trust boundaries. Use parameterized queries. Hash passwords with bcrypt. Never log sensitive data.',
    visibility: 'public',
    ownerId: 'u-seed-bob',
    createdAt: '2024-01-03T10:00:00Z',
    updatedAt: '2024-01-03T10:00:00Z',
  },
];

const SEED_RATINGS: RatingRecord[] = [
  { id: 'r-1', noteId: 'n-seed-1', userId: 'u-seed-alice', value: 5, comment: 'Great intro!', createdAt: '2024-01-02T11:00:00Z', updatedAt: '2024-01-02T11:00:00Z' },
  { id: 'r-2', noteId: 'n-seed-1', userId: 'u-seed-bob', value: 4, comment: null, createdAt: '2024-01-03T11:00:00Z', updatedAt: '2024-01-03T11:00:00Z' },
  { id: 'r-3', noteId: 'n-seed-1', userId: 'u-seed-admin', value: 5, comment: 'Useful overview.', createdAt: '2024-01-04T11:00:00Z', updatedAt: '2024-01-04T11:00:00Z' },
  { id: 'r-4', noteId: 'n-seed-2', userId: 'u-seed-bob', value: 5, comment: 'Very helpful tips!', createdAt: '2024-01-04T12:00:00Z', updatedAt: '2024-01-04T12:00:00Z' },
  { id: 'r-5', noteId: 'n-seed-2', userId: 'u-seed-admin', value: 4, comment: null, createdAt: '2024-01-05T12:00:00Z', updatedAt: '2024-01-05T12:00:00Z' },
  { id: 'r-6', noteId: 'n-seed-2', userId: 'u-seed-alice', value: 5, comment: 'My own note, but great reminder!', createdAt: '2024-01-06T12:00:00Z', updatedAt: '2024-01-06T12:00:00Z' },
  { id: 'r-7', noteId: 'n-seed-4', userId: 'u-seed-alice', value: 5, comment: 'Essential reading.', createdAt: '2024-01-05T10:00:00Z', updatedAt: '2024-01-05T10:00:00Z' },
  { id: 'r-8', noteId: 'n-seed-4', userId: 'u-seed-admin', value: 5, comment: null, createdAt: '2024-01-06T10:00:00Z', updatedAt: '2024-01-06T10:00:00Z' },
  { id: 'r-9', noteId: 'n-seed-4', userId: 'u-seed-bob', value: 4, comment: 'Good reference.', createdAt: '2024-01-07T10:00:00Z', updatedAt: '2024-01-07T10:00:00Z' },
];

const SEED_SHARE_LINKS: ShareLinkRecord[] = [
  { id: 'sl-1', noteId: 'n-seed-1', token: 'demo-share-token-welcome', createdAt: '2024-01-01T10:00:00Z', expiresAt: null },
];

let seeded = false;

function seed(): void {
  if (seeded) return;
  seeded = true;
  for (const u of SEED_USERS) users.set(u.id, u);
  for (const n of SEED_NOTES) notes.set(n.id, n);
  for (const r of SEED_RATINGS) ratings.set(r.id, r);
  for (const sl of SEED_SHARE_LINKS) shareLinks.set(sl.id, sl);
}

seed();

// --- User store operations ---
export const userStore = {
  findById: (id: string): UserRecord | undefined => users.get(id),

  findByUsername: (username: string): UserRecord | undefined => {
    for (const u of users.values()) {
      if (u.username.toLowerCase() === username.toLowerCase()) return u;
    }
    return undefined;
  },

  findByEmail: (email: string): UserRecord | undefined => {
    for (const u of users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return undefined;
  },

  list: (): UserRecord[] => Array.from(users.values()),

  create: (data: Omit<UserRecord, 'noteCount'>): UserRecord => {
    const record: UserRecord = { ...data, noteCount: 0 };
    users.set(record.id, record);
    return record;
  },

  update: (id: string, patch: Partial<Pick<UserRecord, 'username' | 'email' | 'passwordHash'>>): boolean => {
    const u = users.get(id);
    if (!u) return false;
    Object.assign(u, patch);
    return true;
  },

  incrementNoteCount: (id: string, delta: number): void => {
    const u = users.get(id);
    if (u) u.noteCount = Math.max(0, u.noteCount + delta);
  },
};

// --- Note store operations ---
export const noteStore = {
  findById: (id: string): NoteRecord | undefined => notes.get(id),

  list: (): NoteRecord[] => Array.from(notes.values()),

  create: (data: NoteRecord): NoteRecord => {
    notes.set(data.id, data);
    return data;
  },

  update: (id: string, patch: Partial<Pick<NoteRecord, 'title' | 'content' | 'visibility' | 'updatedAt' | 'ownerId'>>): boolean => {
    const n = notes.get(id);
    if (!n) return false;
    Object.assign(n, patch);
    return true;
  },

  delete: (id: string): boolean => notes.delete(id),
};

// --- Rating store operations ---
export const ratingStore = {
  findById: (id: string): RatingRecord | undefined => ratings.get(id),

  findByNoteId: (noteId: string): RatingRecord[] =>
    Array.from(ratings.values()).filter((r) => r.noteId === noteId),

  findByNoteAndUser: (noteId: string, userId: string): RatingRecord | undefined => {
    for (const r of ratings.values()) {
      if (r.noteId === noteId && r.userId === userId) return r;
    }
    return undefined;
  },

  upsert: (data: RatingRecord): RatingRecord => {
    ratings.set(data.id, data);
    return data;
  },

  deleteByNoteId: (noteId: string): void => {
    for (const [id, r] of ratings.entries()) {
      if (r.noteId === noteId) ratings.delete(id);
    }
  },
};

// --- Attachment store operations ---
export const attachmentStore = {
  findByNoteId: (noteId: string): AttachmentRecord[] =>
    Array.from(attachments.values()).filter((a) => a.noteId === noteId),

  create: (data: AttachmentRecord): AttachmentRecord => {
    attachments.set(data.id, data);
    return data;
  },

  delete: (id: string): boolean => attachments.delete(id),

  deleteByNoteId: (noteId: string): void => {
    for (const [id, a] of attachments.entries()) {
      if (a.noteId === noteId) attachments.delete(id);
    }
  },
};

// --- Share link store operations ---
export const shareLinkStore = {
  findByToken: (token: string): ShareLinkRecord | undefined => {
    for (const sl of shareLinks.values()) {
      if (sl.token === token) return sl;
    }
    return undefined;
  },

  findByNoteId: (noteId: string): ShareLinkRecord | undefined => {
    for (const sl of shareLinks.values()) {
      if (sl.noteId === noteId) return sl;
    }
    return undefined;
  },

  create: (data: ShareLinkRecord): ShareLinkRecord => {
    shareLinks.set(data.id, data);
    return data;
  },

  deleteByNoteId: (noteId: string): void => {
    for (const [id, sl] of shareLinks.entries()) {
      if (sl.noteId === noteId) shareLinks.delete(id);
    }
  },
};

// --- Audit log operations ---
export const auditStore = {
  append: (entry: AuditLogRecord): void => {
    auditLogs.push(entry);
    // Keep only last 1000 entries in memory (Availability — prevent unbounded growth)
    if (auditLogs.length > 1000) auditLogs.splice(0, auditLogs.length - 1000);
  },

  recent: (limit: number): AuditLogRecord[] =>
    auditLogs.slice(-limit).reverse(),
};

// --- Password reset token operations ---
export const resetTokenStore = {
  save: (data: PasswordResetToken): void => {
    passwordResetTokens.set(data.token, data);
  },

  find: (token: string): PasswordResetToken | undefined =>
    passwordResetTokens.get(token),

  invalidate: (token: string): void => {
    const t = passwordResetTokens.get(token);
    if (t) t.used = true;
  },
};

export { randomUUID };
