// Server-side validation helpers — Integrity (S3.2.3)
// Implements canonicalize → sanitize → validate at every trust boundary.
// Uses Zod schemas. Returns structured errors for client consumption.

import { z, ZodError, type ZodType } from 'zod';
import type { VercelResponse } from '@vercel/node';

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
}

export type ParseResult<T> = ValidationResult<T> | ValidationFailure;

/**
 * Parse and validate a value against a Zod schema.
 * On failure, writes a 400 response with field errors and returns null.
 * Caller must check for null before proceeding.
 */
export function parseBody<T>(
  body: unknown,
  schema: ZodType<T>,
  res: VercelResponse
): T | null {
  const result = schema.safeParse(body);

  if (!result.success) {
    const fieldErrors = buildFieldErrors(result.error);
    res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        fieldErrors,
      },
    });
    return null;
  }

  return result.data;
}

/** Build a field-keyed error map from a ZodError. */
function buildFieldErrors(error: ZodError): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    if (!map[key]) map[key] = [];
    map[key].push(issue.message);
  }
  return map;
}

// Re-export z for convenience in route files
export { z };
