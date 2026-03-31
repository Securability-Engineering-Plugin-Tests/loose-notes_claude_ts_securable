// ============================================================
// Domain entity types — all fields explicitly typed to enforce
// request surface minimization and prevent type confusion attacks
// ============================================================

export type UserRole = 'user' | 'admin';
export type NoteVisibility = 'public' | 'private';
export type RatingValue = 1 | 2 | 3 | 4 | 5;
export type AttachmentMimeType =
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'image/png'
  | 'image/jpeg';

// --- User ---
export interface User {
  readonly id: string;
  username: string;
  email: string;
  readonly role: UserRole;
  readonly createdAt: string; // ISO 8601
  readonly noteCount: number;
}

// Password NOT included in the User type — confidentiality by design

// --- Note ---
export interface Note {
  readonly id: string;
  title: string;
  content: string;
  visibility: NoteVisibility;
  readonly ownerId: string;
  readonly ownerUsername: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  attachments: Attachment[];
  ratings: Rating[];
  readonly averageRating: number | null;
  readonly ratingCount: number;
}

export interface NoteListItem {
  readonly id: string;
  title: string;
  excerpt: string; // first 200 chars of content
  visibility: NoteVisibility;
  readonly ownerId: string;
  readonly ownerUsername: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly averageRating: number | null;
  readonly ratingCount: number;
}

// --- Attachment ---
export interface Attachment {
  readonly id: string;
  readonly noteId: string;
  readonly originalFilename: string;
  readonly storedFilename: string;
  readonly mimeType: AttachmentMimeType;
  readonly sizeBytes: number;
  readonly uploadedAt: string;
}

// --- Rating ---
export interface Rating {
  readonly id: string;
  readonly noteId: string;
  readonly userId: string;
  readonly username: string;
  value: RatingValue;
  comment: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// --- ShareLink ---
export interface ShareLink {
  readonly id: string;
  readonly noteId: string;
  readonly token: string;
  readonly createdAt: string;
  readonly expiresAt: string | null; // null = never expires
}

// --- AuditLog ---
export interface AuditLog {
  readonly id: string;
  readonly timestamp: string;
  readonly userId: string | null;
  readonly username: string | null;
  readonly action: AuditAction;
  readonly resourceType: AuditResourceType;
  readonly resourceId: string | null;
  readonly ipAddress: string | null;
  readonly outcome: 'success' | 'failure';
  readonly details: string | null; // non-sensitive context only
}

export type AuditAction =
  | 'user.register'
  | 'user.login'
  | 'user.login_failed'
  | 'user.logout'
  | 'user.password_reset_request'
  | 'user.password_reset_complete'
  | 'user.profile_update'
  | 'note.create'
  | 'note.update'
  | 'note.delete'
  | 'note.share_create'
  | 'note.share_revoke'
  | 'note.view_shared'
  | 'rating.create'
  | 'rating.update'
  | 'admin.view_users'
  | 'admin.reassign_note'
  | 'attachment.upload'
  | 'attachment.delete';

export type AuditResourceType =
  | 'user'
  | 'note'
  | 'rating'
  | 'attachment'
  | 'share_link'
  | 'admin';

// ============================================================
// API request/response types — explicit to enforce
// request surface minimization at every trust boundary
// ============================================================

// --- Auth ---
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface UpdateProfileRequest {
  username: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

// --- Notes ---
export interface CreateNoteRequest {
  title: string;
  content: string;
  visibility: NoteVisibility;
}

export interface UpdateNoteRequest {
  title: string;
  content: string;
  visibility: NoteVisibility;
}

export interface SearchNotesQuery {
  q: string;
  page?: number;
  limit?: number;
}

// --- Ratings ---
export interface CreateOrUpdateRatingRequest {
  value: RatingValue;
  comment?: string;
}

// --- Admin ---
export interface ReassignNoteRequest {
  newOwnerId: string;
}

// ============================================================
// API response envelope — consistent structure for all endpoints
// ============================================================

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    // field-level validation errors
    fieldErrors?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// --- Paginated response ---
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// --- Auth session ---
export interface AuthSession {
  user: User;
  token: string;
}

// --- Admin dashboard stats ---
export interface AdminDashboardStats {
  totalUsers: number;
  totalNotes: number;
  publicNoteCount: number;
  privateNoteCount: number;
  totalRatings: number;
  recentAuditLogs: AuditLog[];
  notesByDay: Array<{ date: string; count: number }>;
  ratingDistribution: Array<{ value: number; count: number }>;
}
