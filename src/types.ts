// Type contracts shared between client and server. Mirrors api/_lib/views.ts.
// Keeping a separate copy avoids cross-tree imports and lets the server
// evolve its internal record shapes without breaking the SPA build.

export type Role = 'user' | 'admin';

export interface ApiUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ApiNote {
  id: string;
  ownerId: string;
  ownerUsername: string | null;
  title: string;
  content: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRating {
  id: string;
  noteId: string;
  raterUsername: string | null;
  score: number;
  comment: string;
  createdAt: string;
}

export interface ApiAttachment {
  id: string;
  noteId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ApiAuditEvent {
  id: string;
  ts: string;
  actorId: string | null;
  event: string;
  outcome: 'allow' | 'deny' | 'error' | 'info';
  context: Record<string, unknown>;
}

export interface ApiStats {
  summary: {
    totalUsers: number;
    totalNotes: number;
    publicNotes: number;
    totalRatings: number;
    totalAttachments: number;
  };
  notesPerDay: Array<{ date: string; count: number }>;
  recentAudit: ApiAuditEvent[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}
