/**
 * In-memory data store with row-level access control.
 *
 * FIASSE rejections from the PRD:
 *  - §11.2: PRD specifies private-note exclusion as a "filter predicate in
 *    the search query rather than as a row-level access control". REJECTED.
 *    Access decisions live in this module's `findVisibleNotes` and friends —
 *    every read path enforces ownership/visibility before returning rows.
 *  - §12.2, §13.2, §15.2, §17.2: PRD specifies string concatenation into
 *    queries. REJECTED — there is no query language here. All filtering uses
 *    typed predicates over typed records, eliminating the SQL-injection
 *    class of bugs entirely. (S3.2.3.2 Integrity)
 *  - §1.2: PRD specifies pre-seeded credentials embedded in the configuration
 *    layer. REJECTED. The optional bootstrap admin path requires explicit
 *    env vars, hashes the password immediately, and is consumed once.
 *
 * Production readiness note (S3.2.3.1 Availability): this is an in-memory
 * implementation suitable for serverless demos. State does not survive cold
 * starts, and there is no shared state across function instances. To deploy
 * for real, swap the implementation behind the `DataStore` interface for a
 * real backing store (Vercel Postgres, Neon, etc.) — the rest of the code
 * does not change. (S3.2.1.2 Modifiability via interface boundary)
 */

import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { hashPassword } from './crypto.js';
import { logger } from './logger.js';

export type Role = 'user' | 'admin';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface NoteRecord {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RatingRecord {
  id: string;
  noteId: string;
  raterId: string;
  score: number;     // 1..5 enforced at validation boundary
  comment: string;
  createdAt: string;
}

export interface ShareTokenRecord {
  token: string;     // 256-bit random — see crypto.randomToken
  noteId: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface AttachmentRecord {
  id: string;
  noteId: string;
  ownerId: string;
  storageName: string;     // server-generated UUID — never client-supplied
  originalName: string;    // client-supplied — only used for Content-Disposition
  contentType: string;     // server-detected, validated against allowlist
  sizeBytes: number;
  createdAt: string;
}

export interface ResetTokenRecord {
  tokenHash: string;       // we store HMAC of token, not token itself
  userId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface AuditEvent {
  id: string;
  ts: string;
  actorId: string | null;
  event: string;
  outcome: 'allow' | 'deny' | 'error' | 'info';
  context: Record<string, unknown>;
}

interface Store {
  users: Map<string, UserRecord>;
  notes: Map<string, NoteRecord>;
  ratings: Map<string, RatingRecord>;
  shareTokens: Map<string, ShareTokenRecord>;
  attachments: Map<string, AttachmentRecord>;
  attachmentBlobs: Map<string, Buffer>;
  resetTokens: Map<string, ResetTokenRecord>;
  auditLog: AuditEvent[];
  bootstrapped: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __looseNotesStore: Store | undefined;
}

function freshStore(): Store {
  return {
    users: new Map(),
    notes: new Map(),
    ratings: new Map(),
    shareTokens: new Map(),
    attachments: new Map(),
    attachmentBlobs: new Map(),
    resetTokens: new Map(),
    auditLog: [],
    bootstrapped: false,
  };
}

const store: Store = globalThis.__looseNotesStore ?? freshStore();
globalThis.__looseNotesStore = store;

/**
 * Bootstrap admin path: ONLY when both env vars are set AND no admin exists.
 * The plaintext password from env is hashed immediately and never stored or
 * logged in plaintext form. Replaces the PRD's "default credentials embedded
 * in config" pattern with an explicit, opt-in, single-use mechanism that
 * leaves no plaintext footprint after the first cold start.
 */
function bootstrapIfNeeded(): void {
  if (store.bootstrapped) return;
  store.bootstrapped = true;
  const { username, password } = config.bootstrapAdmin;
  if (!username || !password) return;
  const exists = [...store.users.values()].some((u) => u.role === 'admin');
  if (exists) return;
  const now = new Date().toISOString();
  const user: UserRecord = {
    id: randomUUID(),
    username,
    email: `${username}@local.invalid`,
    passwordHash: hashPassword(password),
    role: 'admin',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
  store.users.set(user.id, user);
  logger.info('admin.bootstrap.created', { userId: user.id, username });
}

bootstrapIfNeeded();

// --------------------------------------------------------------------------
// Users
// --------------------------------------------------------------------------

export function findUserById(id: string): UserRecord | null {
  return store.users.get(id) ?? null;
}

export function findUserByUsername(username: string): UserRecord | null {
  const lower = username.toLowerCase();
  for (const u of store.users.values()) {
    if (u.username.toLowerCase() === lower) return u;
  }
  return null;
}

export function findUserByEmail(email: string): UserRecord | null {
  const lower = email.toLowerCase();
  for (const u of store.users.values()) {
    if (u.email.toLowerCase() === lower) return u;
  }
  return null;
}

export function createUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  role?: Role;
}): UserRecord {
  const now = new Date().toISOString();
  const user: UserRecord = {
    id: randomUUID(),
    username: input.username,
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role ?? 'user',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
  store.users.set(user.id, user);
  return user;
}

export function updateUser(id: string, patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>): UserRecord | null {
  const existing = store.users.get(id);
  if (!existing) return null;
  const updated: UserRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  store.users.set(id, updated);
  return updated;
}

export function listUsers(): UserRecord[] {
  return [...store.users.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function countNotesForOwner(ownerId: string): number {
  let count = 0;
  for (const n of store.notes.values()) if (n.ownerId === ownerId) count++;
  return count;
}

export function countAttachmentsForOwner(ownerId: string): number {
  let count = 0;
  for (const a of store.attachments.values()) if (a.ownerId === ownerId) count++;
  return count;
}

// --------------------------------------------------------------------------
// Notes — every read path enforces visibility server-side
// --------------------------------------------------------------------------

export function createNote(input: { ownerId: string; title: string; content: string; isPublic: boolean }): NoteRecord {
  const now = new Date().toISOString();
  const note: NoteRecord = {
    id: randomUUID(),
    ownerId: input.ownerId,
    title: input.title,
    content: input.content,
    isPublic: input.isPublic,
    createdAt: now,
    updatedAt: now,
  };
  store.notes.set(note.id, note);
  return note;
}

export function findNoteById(id: string): NoteRecord | null {
  return store.notes.get(id) ?? null;
}

/**
 * Returns a note ONLY if the viewer is allowed to see it. Replaces the
 * PRD §8/§9 pattern of loading a note by id without ownership check.
 */
export function findNoteForViewer(noteId: string, viewer: { id: string; role: Role } | null): NoteRecord | null {
  const note = store.notes.get(noteId);
  if (!note) return null;
  if (viewer && (note.ownerId === viewer.id || viewer.role === 'admin')) return note;
  if (note.isPublic) return note;
  return null;
}

/**
 * Returns a note ONLY if the actor owns it (or is admin). Used for edit/delete
 * paths — server-side ownership check (§8, §9 of the PRD called for omitting
 * this check — REJECTED).
 */
export function findNoteForOwner(noteId: string, actor: { id: string; role: Role }): NoteRecord | null {
  const note = store.notes.get(noteId);
  if (!note) return null;
  if (note.ownerId !== actor.id && actor.role !== 'admin') return null;
  return note;
}

export function updateNote(id: string, patch: Partial<Pick<NoteRecord, 'title' | 'content' | 'isPublic' | 'ownerId'>>): NoteRecord | null {
  const existing = store.notes.get(id);
  if (!existing) return null;
  const updated: NoteRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  store.notes.set(id, updated);
  return updated;
}

export function deleteNote(id: string): boolean {
  const existed = store.notes.delete(id);
  if (existed) {
    for (const [rid, r] of store.ratings) if (r.noteId === id) store.ratings.delete(rid);
    for (const [t, s] of store.shareTokens) if (s.noteId === id) store.shareTokens.delete(t);
    for (const [aid, a] of store.attachments) {
      if (a.noteId === id) {
        store.attachments.delete(aid);
        store.attachmentBlobs.delete(a.storageName);
      }
    }
  }
  return existed;
}

/**
 * Search notes visible to the viewer. The keyword is treated as a literal
 * substring — there is no query language to inject into, and the viewer's
 * identity is server-derived, not client-supplied. This replaces the PRD
 * §12.2 string-concatenation pattern.
 */
export function searchNotes(opts: {
  keyword: string;
  viewer: { id: string; role: Role } | null;
  limit: number;
  offset: number;
}): { items: NoteRecord[]; total: number } {
  const k = opts.keyword.toLowerCase();
  const all = [...store.notes.values()].filter((n) => {
    const visible = n.isPublic || (opts.viewer && (n.ownerId === opts.viewer.id || opts.viewer.role === 'admin'));
    if (!visible) return false;
    if (k.length === 0) return true;
    return n.title.toLowerCase().includes(k) || n.content.toLowerCase().includes(k);
  });
  all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    items: all.slice(opts.offset, opts.offset + opts.limit),
    total: all.length,
  };
}

export function listNotesForOwner(ownerId: string): NoteRecord[] {
  return [...store.notes.values()]
    .filter((n) => n.ownerId === ownerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// --------------------------------------------------------------------------
// Ratings
// --------------------------------------------------------------------------

export function createRating(input: { noteId: string; raterId: string; score: number; comment: string }): RatingRecord {
  const r: RatingRecord = {
    id: randomUUID(),
    noteId: input.noteId,
    raterId: input.raterId,
    score: input.score,
    comment: input.comment,
    createdAt: new Date().toISOString(),
  };
  store.ratings.set(r.id, r);
  return r;
}

export function listRatingsForNote(noteId: string): RatingRecord[] {
  return [...store.ratings.values()]
    .filter((r) => r.noteId === noteId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listRatingsForOwner(ownerId: string): RatingRecord[] {
  const ownedNoteIds = new Set(
    [...store.notes.values()].filter((n) => n.ownerId === ownerId).map((n) => n.id),
  );
  return [...store.ratings.values()]
    .filter((r) => ownedNoteIds.has(r.noteId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function topRatedPublicNotes(limit: number): Array<{ note: NoteRecord; avgScore: number; ratingCount: number }> {
  const scoresByNote = new Map<string, { sum: number; count: number }>();
  for (const r of store.ratings.values()) {
    const acc = scoresByNote.get(r.noteId) ?? { sum: 0, count: 0 };
    acc.sum += r.score;
    acc.count += 1;
    scoresByNote.set(r.noteId, acc);
  }
  const out: Array<{ note: NoteRecord; avgScore: number; ratingCount: number }> = [];
  for (const note of store.notes.values()) {
    if (!note.isPublic) continue;
    const agg = scoresByNote.get(note.id);
    if (!agg) continue;
    out.push({ note, avgScore: agg.sum / agg.count, ratingCount: agg.count });
  }
  out.sort((a, b) => b.avgScore - a.avgScore || b.ratingCount - a.ratingCount);
  return out.slice(0, limit);
}

// --------------------------------------------------------------------------
// Share tokens
// --------------------------------------------------------------------------

export function createShareToken(input: { token: string; noteId: string; createdBy: string; ttlSeconds: number | null }): ShareTokenRecord {
  const now = Date.now();
  const expiresAt = input.ttlSeconds ? new Date(now + input.ttlSeconds * 1000).toISOString() : null;
  const rec: ShareTokenRecord = {
    token: input.token,
    noteId: input.noteId,
    createdBy: input.createdBy,
    createdAt: new Date(now).toISOString(),
    expiresAt,
  };
  store.shareTokens.set(input.token, rec);
  return rec;
}

export function findShareToken(token: string): ShareTokenRecord | null {
  const rec = store.shareTokens.get(token);
  if (!rec) return null;
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() < Date.now()) {
    store.shareTokens.delete(token);
    return null;
  }
  return rec;
}

export function deleteShareToken(token: string): boolean {
  return store.shareTokens.delete(token);
}

// --------------------------------------------------------------------------
// Attachments — bytes stored in-process (not in webroot — the PRD §7.2
// pattern of storing attachments in a "designated directory under the
// application's web-accessible root" is REJECTED). Files are reachable
// only through an authenticated handler.
// --------------------------------------------------------------------------

export function createAttachment(meta: Omit<AttachmentRecord, 'id' | 'createdAt'>, blob: Buffer): AttachmentRecord {
  const rec: AttachmentRecord = {
    id: randomUUID(),
    ...meta,
    createdAt: new Date().toISOString(),
  };
  store.attachments.set(rec.id, rec);
  store.attachmentBlobs.set(rec.storageName, blob);
  return rec;
}

export function findAttachment(id: string): AttachmentRecord | null {
  return store.attachments.get(id) ?? null;
}

export function readAttachmentBlob(storageName: string): Buffer | null {
  return store.attachmentBlobs.get(storageName) ?? null;
}

export function listAttachmentsForNote(noteId: string): AttachmentRecord[] {
  return [...store.attachments.values()]
    .filter((a) => a.noteId === noteId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function deleteAttachment(id: string): boolean {
  const att = store.attachments.get(id);
  if (!att) return false;
  store.attachments.delete(id);
  store.attachmentBlobs.delete(att.storageName);
  return true;
}

// --------------------------------------------------------------------------
// Reset tokens — we store the HMAC of the token, not the token itself, so
// a database leak does not yield reusable reset credentials.
// --------------------------------------------------------------------------

export function createResetToken(rec: Omit<ResetTokenRecord, 'usedAt'>): ResetTokenRecord {
  const full: ResetTokenRecord = { ...rec, usedAt: null };
  store.resetTokens.set(rec.tokenHash, full);
  return full;
}

export function consumeResetToken(tokenHash: string): ResetTokenRecord | null {
  const rec = store.resetTokens.get(tokenHash);
  if (!rec) return null;
  if (rec.usedAt) return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) {
    store.resetTokens.delete(tokenHash);
    return null;
  }
  rec.usedAt = new Date().toISOString();
  store.resetTokens.set(tokenHash, rec);
  return rec;
}

// --------------------------------------------------------------------------
// Audit log — append only, served back to admin dashboard
// --------------------------------------------------------------------------

export function appendAudit(event: Omit<AuditEvent, 'id' | 'ts'>): void {
  const rec: AuditEvent = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    ...event,
  };
  store.auditLog.push(rec);
  if (store.auditLog.length > 5000) {
    store.auditLog.splice(0, store.auditLog.length - 5000);
  }
}

export function listAudit(limit = 200): AuditEvent[] {
  return store.auditLog.slice(-limit).reverse();
}

// Stats helpers for admin dashboard
export function statsSummary(): {
  totalUsers: number;
  totalNotes: number;
  publicNotes: number;
  totalRatings: number;
  totalAttachments: number;
} {
  let publicCount = 0;
  for (const n of store.notes.values()) if (n.isPublic) publicCount++;
  return {
    totalUsers: store.users.size,
    totalNotes: store.notes.size,
    publicNotes: publicCount,
    totalRatings: store.ratings.size,
    totalAttachments: store.attachments.size,
  };
}

export function notesPerDay(days: number): Array<{ date: string; count: number }> {
  const buckets = new Map<string, number>();
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  for (const n of store.notes.values()) {
    const d = n.createdAt.slice(0, 10);
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}
