// ────────────────────────────────────────────────────────────────────────────
// Domain types — single source of truth shared between frontend and API layer.
// Sensitive fields (passwordHash, securityAnswerHash) are absent from these
// public types; they live only inside server-side DB records.
// ────────────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  securityQuestion?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  isPublic: boolean;
  ownerId: string;
  ownerUsername: string;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  averageRating?: number;
  ratingCount?: number;
}

export interface Attachment {
  id: string;
  /** Sanitized server-assigned filename — safe for display and download. */
  filename: string;
  /** Original client-supplied name — display only, never used for file I/O. */
  originalName: string;
  contentType: string;
  size: number;
  noteId: string;
  uploadedAt: string;
}

export interface Rating {
  id: string;
  noteId: string;
  userId: string;
  username: string;
  /** Integer 1–5. Validated server-side. */
  score: number;
  comment: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  /** CSRF token delivered in JSON body; stored in memory (not localStorage). */
  csrfToken: string;
}

export interface ApiError {
  message: string;
  code: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchResult {
  notes: Note[];
  total: number;
}

export interface ShareableLink {
  url: string;
  token: string;
}

export interface ExportManifest {
  exportedAt: string;
  notes: ExportNote[];
}

export interface ExportNote {
  id: number;
  title: string;
  content: string;
  isPublic: boolean;
  createdAt: string;
  attachments?: ExportAttachment[];
}

export interface ExportAttachment {
  filename: string;
  originalName?: string;
  contentType?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalNotes: number;
  publicNotes: number;
  totalRatings: number;
}

export interface RatingsSummary {
  noteId: string;
  noteTitle: string;
  averageRating: number;
  ratingCount: number;
  distribution: Record<number, number>;
}
