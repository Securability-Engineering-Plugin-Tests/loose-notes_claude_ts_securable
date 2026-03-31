import { apiRequest } from './api';
import { ApiError } from './authService';
import type { Note, NoteListItem, PaginatedResult } from '@/types';

export interface CreateNoteData {
  title: string;
  content: string;
  visibility: 'public' | 'private';
}

export interface UpdateNoteData {
  title: string;
  content: string;
  visibility: 'public' | 'private';
}

export async function getMyNotes(): Promise<NoteListItem[]> {
  const result = await apiRequest<NoteListItem[]>('/api/notes');
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function getNoteById(id: string): Promise<Note> {
  const result = await apiRequest<Note>(`/api/notes/${encodeURIComponent(id)}`);
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function createNote(data: CreateNoteData): Promise<NoteListItem> {
  const result = await apiRequest<NoteListItem>('/api/notes', {
    method: 'POST',
    body: data,
  });
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function updateNote(id: string, data: UpdateNoteData): Promise<void> {
  const result = await apiRequest(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data,
  });
  if (!result.ok) throw new ApiError(result.error);
}

export async function deleteNote(id: string): Promise<void> {
  const result = await apiRequest(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!result.ok) throw new ApiError(result.error);
}

export async function searchNotes(q: string, page = 1, limit = 20): Promise<PaginatedResult<NoteListItem>> {
  const params = new URLSearchParams({ q, page: String(page), limit: String(limit) });
  const result = await apiRequest<PaginatedResult<NoteListItem>>(`/api/notes/search?${params}`);
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function getTopRatedNotes(): Promise<NoteListItem[]> {
  const result = await apiRequest<NoteListItem[]>('/api/notes/top-rated');
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function generateShareLink(noteId: string): Promise<string> {
  const result = await apiRequest<{ token: string }>(`/api/notes/share?noteId=${encodeURIComponent(noteId)}`, {
    method: 'POST',
  });
  if (!result.ok) throw new ApiError(result.error);
  return result.data.token;
}

export async function revokeShareLink(noteId: string): Promise<void> {
  const result = await apiRequest(`/api/notes/share?noteId=${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
  });
  if (!result.ok) throw new ApiError(result.error);
}

export async function getSharedNote(token: string): Promise<Note> {
  const result = await apiRequest<Note>(`/api/share/${encodeURIComponent(token)}`);
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}
