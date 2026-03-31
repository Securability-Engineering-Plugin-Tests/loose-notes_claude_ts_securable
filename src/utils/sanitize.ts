// Input sanitization utilities — Integrity (S3.2.3)
// Implements canonicalize → sanitize → validate pattern (S6.4.1)
// Applied at every trust boundary before processing user input

/**
 * Canonicalize a string input: trim whitespace, normalize unicode.
 * Step 1 of canonicalize → sanitize → validate.
 */
export function canonicalize(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Normalize unicode to NFC form, then trim
  return input.normalize('NFC').trim();
}

/**
 * Strip dangerous HTML characters to prevent XSS.
 * Step 2 of canonicalize → sanitize → validate.
 * NOTE: For rich text, use a proper DOMPurify-based sanitizer.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize a search query: remove special characters that could
 * cause issues in case-insensitive string matching.
 */
export function sanitizeSearchQuery(input: string): string {
  // Allow alphanumeric, spaces, hyphens, apostrophes
  return canonicalize(input).replace(/[^\w\s\-']/g, '').slice(0, 200);
}

/**
 * Sanitize a username: only allow alphanumeric, underscores, hyphens.
 * Length limited at sanitization step (further constrained by Zod schema).
 */
export function sanitizeUsername(input: string): string {
  return canonicalize(input).replace(/[^\w\-]/g, '').slice(0, 50);
}

/**
 * Normalize email to lowercase canonical form.
 */
export function normalizeEmail(input: string): string {
  return canonicalize(input).toLowerCase();
}

/**
 * Extract only the expected scalar value from a potentially nested or
 * array-coerced query parameter — Request Surface Minimization (S6.4.1.1).
 */
export function extractScalarParam(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  if (typeof value === 'string') return value;
  return '';
}
