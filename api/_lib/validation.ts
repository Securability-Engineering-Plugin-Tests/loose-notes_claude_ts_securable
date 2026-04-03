/**
 * Centralised input validation schemas (Zod).
 *
 * SSEM: Integrity — canonicalize → sanitize → validate at every trust boundary.
 * FIASSE S6.4.1: Canonical Input Handling + Request Surface Minimization.
 *
 * All schemas enforce strict types. Extra/unexpected fields are stripped
 * (z.object().strict() where applicable).
 */

import { z } from 'zod';

// ── Password policy ──────────────────────────────────────────────────────────
// PRD §16.2 required no policy. ASVS V2.1 mandates minimum length + complexity.
const PASSWORD_SCHEMA = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const USERNAME_SCHEMA = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must not exceed 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, digits, hyphens, and underscores');

const EMAIL_SCHEMA = z.string().email('Invalid email address').max(254);

// ── Auth schemas ─────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  username: USERNAME_SCHEMA,
  email: EMAIL_SCHEMA,
  password: PASSWORD_SCHEMA,
  securityQuestion: z.enum([
    'What was the name of your first pet?',
    'What is your mother\'s maiden name?',
    'What city were you born in?',
    'What was the name of your elementary school?',
    'What is your oldest sibling\'s middle name?',
  ]),
  securityAnswer: z.string().min(2).max(200),
});

export const LoginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(128),
});

export const ForgotPasswordSchema = z.object({
  email: EMAIL_SCHEMA,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  securityAnswer: z.string().min(1).max(200),
  newPassword: PASSWORD_SCHEMA,
  confirmPassword: PASSWORD_SCHEMA,
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ── Note schemas ─────────────────────────────────────────────────────────────
export const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(50_000),
  isPublic: z.boolean().default(false),
});

export const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  content: z.string().min(1).max(50_000).optional(),
  isPublic: z.boolean().optional(),
});

// ── Search ───────────────────────────────────────────────────────────────────
export const SearchSchema = z.object({
  q: z.string().min(1).max(200).trim(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Rating ───────────────────────────────────────────────────────────────────
export const RatingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).trim().default(''),
});

// ── Profile update ───────────────────────────────────────────────────────────
export const UpdateProfileSchema = z.object({
  email: EMAIL_SCHEMA.optional(),
  currentPassword: z.string().min(1).max(128),
  newPassword: PASSWORD_SCHEMA.optional(),
  confirmPassword: z.string().max(128).optional(),
}).refine(
  d => !d.newPassword || d.newPassword === d.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] },
);

// ── Admin schemas ─────────────────────────────────────────────────────────────
export const ReassignNoteSchema = z.object({
  noteId: z.string().uuid(),
  targetUserId: z.string().uuid(),
});

// ── Pagination ───────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Attachment download ───────────────────────────────────────────────────────
// Only accept a note-scoped UUID reference, not a raw filename path
export const AttachmentDownloadSchema = z.object({
  attachmentId: z.string().uuid(),
});

// ── Top-rated filter ─────────────────────────────────────────────────────────
// PRD §17.2 concatenated the filter value. We use an allowlist instead.
export const TopRatedFilterSchema = z.object({
  tag: z.enum(['general', 'technology', 'science', 'arts', 'other']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Email autocomplete ────────────────────────────────────────────────────────
// PRD §15.2 required no auth on this endpoint. We require auth AND parameterise.
export const AutocompleteSchema = z.object({
  q: z.string().min(2).max(100).trim(),
});
