// Shared API-layer types — server-side only
// Extends domain types with server concerns

import type { User, AuditAction, AuditResourceType } from '../../src/types/index.js';

// Internal user record includes the hashed password
// Password hash NEVER leaves the server (Confidentiality)
export interface UserRecord extends Omit<User, 'noteCount'> {
  readonly passwordHash: string;
  noteCount: number;
}

export interface PasswordResetToken {
  readonly token: string;
  readonly userId: string;
  readonly expiresAt: number; // Unix ms timestamp
  used: boolean;
}

export interface NoteRecord {
  readonly id: string;
  title: string;
  content: string;
  visibility: 'public' | 'private';
  readonly ownerId: string;
  readonly createdAt: string;
  updatedAt: string;
}

export interface RatingRecord {
  readonly id: string;
  readonly noteId: string;
  readonly userId: string;
  value: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  readonly createdAt: string;
  updatedAt: string;
}

export interface AttachmentRecord {
  readonly id: string;
  readonly noteId: string;
  readonly originalFilename: string;
  readonly storedFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedAt: string;
}

export interface ShareLinkRecord {
  readonly id: string;
  readonly noteId: string;
  readonly token: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}

export interface AuditLogRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly userId: string | null;
  readonly action: AuditAction;
  readonly resourceType: AuditResourceType;
  readonly resourceId: string | null;
  readonly ipAddress: string | null;
  readonly outcome: 'success' | 'failure';
  readonly details: string | null;
}

export interface JwtPayload {
  sub: string;         // userId
  username: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
}

export interface AuthContext {
  userId: string;
  username: string;
  role: 'user' | 'admin';
}
