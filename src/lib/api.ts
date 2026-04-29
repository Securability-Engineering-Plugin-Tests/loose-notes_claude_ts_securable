/**
 * Typed API client.
 *
 * FIASSE: a single, narrowly-typed seam between UI and HTTP concerns
 * (S3.2.1.2 Modifiability). Pages and components never call `fetch`
 * directly — every request flows through this module so credential mode,
 * error shape, and content-type are uniform. Errors are turned into a
 * typed `ApiError` so callers can react without parsing prose.
 */

import type { ApiNote, ApiRating, ApiUser, ApiStats, ApiAttachment } from '../types';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;
  constructor(code: string, message: string, status: number, requestId: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  };
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }

  const res = await fetch(path, init);
  const requestId = res.headers.get('x-request-id') ?? '';

  // 204: explicit no-content paths (logout, delete).
  if (res.status === 204) return undefined as T;

  // Non-JSON downloads (attachments) — caller uses a separate path.
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new ApiError('invalid_response', `Unexpected response content-type: ${ct}`, res.status, requestId);
  }

  const json = (await res.json()) as ApiEnvelope<T> | { error: { code: string; message: string; requestId: string } };

  if (!res.ok || 'error' in json) {
    const err = (json as { error: { code: string; message: string; requestId: string } }).error;
    throw new ApiError(err?.code ?? 'http_error', err?.message ?? `HTTP ${res.status}`, res.status, err?.requestId ?? requestId);
  }

  return (json as ApiEnvelope<T>).data;
}

export const api = {
  // Auth
  register: (input: { username: string; email: string; password: string }) =>
    request<ApiUser>('POST', '/api/auth/register', input),
  login: (input: { username: string; password: string }) =>
    request<ApiUser>('POST', '/api/auth/login', input),
  logout: () => request<void>('POST', '/api/auth/logout'),
  me: () => request<ApiUser | null>('GET', '/api/auth/me'),
  resetRequest: (email: string) =>
    request<{ message: string; devToken?: string; devTtlSeconds?: number }>(
      'POST', '/api/auth/reset-request', { email },
    ),
  resetConfirm: (token: string, newPassword: string) =>
    request<{ message: string }>('POST', '/api/auth/reset-confirm', { token, newPassword }),

  // Profile
  profile: () => request<ApiUser>('GET', '/api/users/me'),
  updateProfile: (patch: { email?: string; currentPassword?: string; newPassword?: string }) =>
    request<ApiUser>('PATCH', '/api/users/me', patch),
  emailAutocomplete: (prefix: string) =>
    request<{ suggestions: Array<{ email: string; username: string }> }>(
      'GET', `/api/users/autocomplete?prefix=${encodeURIComponent(prefix)}`,
    ),

  // Notes
  searchNotes: (q: { q?: string; filter?: 'all' | 'mine' | 'public'; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (q.q) params.set('q', q.q);
    if (q.filter) params.set('filter', q.filter);
    if (q.limit) params.set('limit', String(q.limit));
    if (q.offset) params.set('offset', String(q.offset));
    return request<{ items: ApiNote[]; total: number; limit: number; offset: number }>(
      'GET', `/api/notes?${params.toString()}`,
    );
  },
  createNote: (input: { title: string; content: string; isPublic: boolean }) =>
    request<ApiNote>('POST', '/api/notes', input),
  getNote: (id: string) =>
    request<{ note: ApiNote; ratings: ApiRating[]; attachments: ApiAttachment[] }>(
      'GET', `/api/notes/${id}`,
    ),
  updateNote: (id: string, patch: { title?: string; content?: string; isPublic?: boolean }) =>
    request<ApiNote>('PATCH', `/api/notes/${id}`, patch),
  deleteNote: (id: string) => request<void>('DELETE', `/api/notes/${id}`),
  shareNote: (input: { noteId: string; ttlMinutes: number }) =>
    request<{ token: string; expiresAt: string | null; sharePath: string }>(
      'POST', '/api/notes/share', input,
    ),
  rateNote: (input: { noteId: string; score: number; comment: string }) =>
    request<ApiRating>('POST', '/api/notes/rate', input),
  topNotes: (limit = 10, region: 'global' | 'recent' = 'global') =>
    request<Array<{ note: ApiNote; avgScore: number; ratingCount: number }>>(
      'GET', `/api/notes/top?limit=${limit}&region=${region}`,
    ),

  // Shared (public)
  readShared: (token: string) =>
    request<{ note: ApiNote; expiresAt: string | null }>('GET', `/api/shared/${token}`),

  // Attachments
  uploadAttachment: (noteId: string, file: File) => {
    const fd = new FormData();
    fd.append('noteId', noteId);
    fd.append('file', file);
    return request<ApiAttachment>('POST', '/api/attachments', fd);
  },

  // Admin
  adminUsers: () => request<ApiUser[]>('GET', '/api/admin/users'),
  adminStats: () => request<ApiStats>('GET', '/api/admin/stats'),
  adminReassign: (input: { noteId: string; newOwnerId: string }) =>
    request<ApiNote>('POST', '/api/admin/reassign', input),
};
