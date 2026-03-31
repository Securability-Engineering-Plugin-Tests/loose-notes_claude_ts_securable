// Client-side validation schemas using Zod — Integrity (S3.2.3)
// Shared schema definitions mirror server-side schemas for consistency.
// Step 3 of canonicalize → sanitize → validate.

import { z } from 'zod';

// --- Common constraints ---
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const TITLE_MAX = 200;
const CONTENT_MAX = 50_000;
const COMMENT_MAX = 1000;

// Username: alphanumeric + underscores + hyphens only
const usernameSchema = z
  .string()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens');

// Email with reasonable constraints
const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(254, 'Email address too long') // RFC 5321 max length
  .toLowerCase();

// Password with minimum complexity requirements
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// --- Auth schemas ---
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(USERNAME_MAX),
  password: z.string().min(1, 'Password is required').max(PASSWORD_MAX),
});

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// --- Note schemas ---
export const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(TITLE_MAX, `Title must be at most ${TITLE_MAX} characters`),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(CONTENT_MAX, `Content must be at most ${CONTENT_MAX} characters`),
  visibility: z.enum(['public', 'private']),
});

export const updateNoteSchema = createNoteSchema;

// --- Rating schema ---
export const ratingSchema = z.object({
  value: z.number().int().min(1).max(5) as z.ZodType<1 | 2 | 3 | 4 | 5>,
  comment: z
    .string()
    .max(COMMENT_MAX, `Comment must be at most ${COMMENT_MAX} characters`)
    .optional(),
});

// --- Profile schema ---
export const updateProfileSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  currentPassword: z.string().max(PASSWORD_MAX).optional(),
  newPassword: passwordSchema.optional(),
}).refine(
  (d) => {
    // If new password provided, current password must also be provided
    if (d.newPassword && !d.currentPassword) return false;
    return true;
  },
  { message: 'Current password is required to set a new password', path: ['currentPassword'] }
);

// --- Search schema ---
export const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

// Type inference helpers
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type RatingInput = z.infer<typeof ratingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
