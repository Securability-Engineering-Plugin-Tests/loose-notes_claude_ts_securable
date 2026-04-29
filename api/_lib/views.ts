/**
 * View projections — shape DB records into safe outbound JSON.
 *
 * FIASSE: Confidentiality (S3.2.2.1) — never leak fields the caller does not
 * need. Request Surface Minimization on the response side: we project only
 * the fields each view requires. Sanitize stored values on the way out as
 * defense-in-depth, even though React escapes interpolated text already.
 */

import type {
  AttachmentRecord,
  AuditEvent,
  NoteRecord,
  RatingRecord,
  UserRecord,
} from './db.js';
import { stripHtml } from './sanitize.js';

export interface NoteView {
  id: string;
  ownerId: string;
  ownerUsername: string | null;
  title: string;
  content: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserView {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface RatingView {
  id: string;
  noteId: string;
  raterUsername: string | null;
  score: number;
  comment: string;
  createdAt: string;
}

export interface AttachmentView {
  id: string;
  noteId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export function noteView(note: NoteRecord, owner?: UserRecord | null): NoteView {
  return {
    id: note.id,
    ownerId: note.ownerId,
    ownerUsername: owner?.username ?? null,
    title: stripHtml(note.title),
    content: stripHtml(note.content),
    isPublic: note.isPublic,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function userView(user: UserRecord): UserView {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function ratingView(rating: RatingRecord, rater?: UserRecord | null): RatingView {
  return {
    id: rating.id,
    noteId: rating.noteId,
    raterUsername: rater?.username ?? null,
    score: rating.score,
    comment: stripHtml(rating.comment),
    createdAt: rating.createdAt,
  };
}

export function attachmentView(att: AttachmentRecord): AttachmentView {
  return {
    id: att.id,
    noteId: att.noteId,
    originalName: stripHtml(att.originalName),
    contentType: att.contentType,
    sizeBytes: att.sizeBytes,
    createdAt: att.createdAt,
  };
}

export function auditView(event: AuditEvent): AuditEvent {
  // Audit events are constructed server-side and already redacted at write
  // time via the structured logger; no transform needed for outbound.
  return event;
}
