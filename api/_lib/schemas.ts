/**
 * Zod schemas for every request body / query parameter the API accepts.
 *
 * FIASSE: input validation at the boundary (S4.4.1 Canonical Input Handling,
 * S3.2.3.2 Integrity). Each schema is the single source of truth for the
 * shape and constraints of a request — handlers never touch raw values.
 *
 * Request Surface Minimization (S4.4.1.1): every schema lists ONLY the named
 * fields the handler will use. Unknown fields are stripped (`.strip()` is
 * the zod default). This blocks mass-assignment attacks where a client
 * tries to set `role: 'admin'` via a profile update, etc.
 */

import { z } from 'zod';

// --- Primitive constraints -------------------------------------------------

// Username: 3-32 chars, alphanumeric + . _ -; no leading/trailing punctuation
export const Username = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{1,30}[a-zA-Z0-9])?$/, 'Invalid username');

// Email — RFC 5322 is sprawling; we use a pragmatic subset that fits the UI.
export const EmailAddress = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid email address');

// Password policy: minimum 12 characters; we deliberately do NOT enforce
// arcane composition rules (NIST SP 800-63B §5.1.1.2 has shown they hurt
// more than they help). The PRD §16 "no minimum length, complexity, or
// policy check" is REJECTED.
export const Password = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(256, 'Password is too long');

// UUID v4 produced by node:crypto.randomUUID — used as primary key everywhere.
export const Uuid = z.string().uuid('Invalid identifier');

// Free-text title and content with bounds chosen to fit the body-size limit.
export const NoteTitle = z.string().trim().min(1, 'Title required').max(200);
export const NoteContent = z.string().min(0).max(40_000);

// --- Auth ------------------------------------------------------------------

export const RegisterSchema = z.object({
  username: Username,
  email: EmailAddress,
  password: Password,
}).strict();

export const LoginSchema = z.object({
  username: Username,
  password: z.string().min(1).max(256), // No min-length on login — that's enrollment-only.
}).strict();

export const ResetRequestSchema = z.object({
  email: EmailAddress,
}).strict();

export const ResetConfirmSchema = z.object({
  token: z.string().min(20).max(256),
  newPassword: Password,
}).strict();

// --- Profile ---------------------------------------------------------------

// Note: NO role field, NO id field — server-owned state is never accepted
// from the client. (Derived Integrity, S4.4.1.2)
export const UpdateProfileSchema = z.object({
  email: EmailAddress.optional(),
  currentPassword: z.string().min(1).max(256).optional(),
  newPassword: Password.optional(),
}).strict().refine(
  (v) => !v.newPassword || v.currentPassword,
  { message: 'currentPassword is required to change password', path: ['currentPassword'] },
);

// --- Notes -----------------------------------------------------------------

export const CreateNoteSchema = z.object({
  title: NoteTitle,
  content: NoteContent,
  isPublic: z.boolean().default(false),
}).strict();

export const UpdateNoteSchema = z.object({
  title: NoteTitle.optional(),
  content: NoteContent.optional(),
  isPublic: z.boolean().optional(),
}).strict();

export const SearchSchema = z.object({
  q: z.string().max(200).default(''),
  // Top-rated filter — allowlist only, no free-form value
  filter: z.enum(['all', 'mine', 'public']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const ShareSchema = z.object({
  ttlMinutes: z.coerce.number().int().min(1).max(60 * 24 * 7).default(60 * 24),
}).strict();

export const RatingSchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(''),
}).strict();

// --- Admin -----------------------------------------------------------------

export const ReassignSchema = z.object({
  noteId: Uuid,
  newOwnerId: Uuid,
}).strict();

// --- Top-rated filter ------------------------------------------------------

export const TopRatedSchema = z.object({
  // PRD §17.2 specifies a free-form filter value concatenated into a query.
  // REJECTED — we accept only an allow-listed enum.
  region: z.enum(['global', 'recent']).default('global'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// --- Email autocomplete ----------------------------------------------------

// PRD §15: anonymous, unparameterized prefix-match. REJECTED — we require
// authentication and constrain the prefix shape.
export const EmailLookupSchema = z.object({
  prefix: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._%+@-]+$/, 'Invalid prefix'),
});

// --- Attachment download ---------------------------------------------------

// Attachment id is the canonical reference — we never accept a filename from
// the client as a path component (the PRD §23 pattern is REJECTED).
export const AttachmentIdSchema = z.object({
  id: Uuid,
});
