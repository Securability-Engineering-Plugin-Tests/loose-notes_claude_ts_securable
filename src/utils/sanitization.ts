/**
 * HTML sanitisation utilities for safe rich-text rendering.
 *
 * SSEM: Integrity — output encoding when crossing the trust boundary from
 * stored data to rendered HTML. PRD §6.2 required no encoding transformation.
 *
 * React's JSX escapes HTML by default, so most output is safe. This module
 * is used only when dangerouslySetInnerHTML is unavoidable (e.g. rich text).
 *
 * DOMPurify is the canonical client-side sanitisation library:
 * - Actively maintained with rapid response to bypass disclosures
 * - Allowlist-based (strips everything not explicitly permitted)
 */

import DOMPurify from 'dompurify';

/** Allowlisted HTML tags for note content rendering. */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'span',
];

/** Allowlisted attributes. */
const ALLOWED_ATTR = ['href', 'title', 'class', 'target', 'rel'];

/**
 * Sanitize HTML content for safe rendering.
 * Use this before any dangerouslySetInnerHTML assignment.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Force external links to open safely
    ADD_ATTR: ['target'],
    FORCE_BODY: false,
  });
}

/**
 * Sanitize and force all links to open in a new tab with noopener noreferrer.
 * Used for note content with hyperlinks.
 */
export function sanitizeNoteContent(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORCE_BODY: false,
  });
  // Replace all <a> tags to add security attributes
  return clean.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
}

/** Escape plain text for display in HTML contexts (no HTML allowed). */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
