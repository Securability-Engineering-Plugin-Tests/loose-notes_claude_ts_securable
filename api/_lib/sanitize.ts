/**
 * Output sanitization for content that may be rendered as HTML.
 *
 * FIASSE rejection from the PRD:
 *  - §6.2, §13.2, §14.2, §23.2, §25.2: PRD specifies inserting stored values
 *    "directly into the rendered HTML response without any prior encoding
 *    transformation". REJECTED across the board. Note titles, note content,
 *    rating comments, error pages, and diagnostic dumps are output-encoded
 *    (S3.2.3.2 Integrity, S2.5 Transparency).
 *
 * We do TWO things:
 *  1. Server-side: strip all HTML from stored values before emitting JSON,
 *     using DOMPurify in HTML-stripping mode. This is belt-and-braces — the
 *     React frontend already escapes all interpolated text by default.
 *  2. Client-side: also normalizes for any flows that need to render
 *     pre-formatted text without re-allowing tags.
 *
 * If a future feature wants rich-text rendering, the call-site should call
 * `sanitizeRichHtml` with an explicit allow-list rather than disabling
 * sanitization globally.
 */

import DOMPurify from 'isomorphic-dompurify';

/** Strip ALL HTML — preserves only text. Use for plain-text fields stored as strings. */
export function stripHtml(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Sanitize content that the application has decided should support a small
 * formatting whitelist. This is OPT-IN per call-site — never wire this to a
 * pass-through field by default.
 */
export function sanitizeRichHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: [],
    USE_PROFILES: { html: true },
  });
}

/**
 * HTML-encode an arbitrary string for safe inclusion as text inside an HTML
 * document. Used by the diagnostics page so we never echo raw header values
 * into a response body. (PRD §25 explicitly skipped this — REJECTED.)
 */
export function htmlEncodeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
