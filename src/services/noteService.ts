import { api } from './api';
import type { Note, PaginatedResponse, SearchResult, ShareableLink, Rating } from '../types';

export const noteService = {
  async list(page = 1, pageSize = 20): Promise<PaginatedResponse<Note>> {
    return api.get<PaginatedResponse<Note>>(`/notes?page=${page}&pageSize=${pageSize}`);
  },

  async get(id: string): Promise<Note> {
    return api.get<Note>(`/notes/${encodeURIComponent(id)}`);
  },

  async create(data: { title: string; content: string; isPublic: boolean }): Promise<Note> {
    return api.post<Note>('/notes', data);
  },

  async update(id: string, data: { title?: string; content?: string; isPublic?: boolean }): Promise<Note> {
    return api.put<Note>(`/notes/${encodeURIComponent(id)}`, data);
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/notes/${encodeURIComponent(id)}`);
  },

  async search(query: string, page = 1, pageSize = 20): Promise<SearchResult> {
    const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(pageSize) });
    return api.get<SearchResult>(`/notes/search?${params.toString()}`);
  },

  async createShareLink(noteId: string): Promise<ShareableLink> {
    return api.post<ShareableLink>('/notes/share', { noteId });
  },

  async getSharedNote(token: string): Promise<Note> {
    return api.get<Note>(`/notes/share?token=${encodeURIComponent(token)}`);
  },

  async getRatings(noteId: string): Promise<Rating[]> {
    return api.get<Rating[]>(`/ratings?noteId=${encodeURIComponent(noteId)}`);
  },

  async rate(noteId: string, score: number, comment: string): Promise<{ id: string; score: number }> {
    return api.post('/ratings', { noteId, score, comment });
  },

  async getTopRated(params: { tag?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResponse<Note>> {
    const query = new URLSearchParams();
    if (params.tag) query.set('tag', params.tag);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return api.get<PaginatedResponse<Note>>(`/top-rated?${query.toString()}`);
  },

  async getSharedNotePublic(token: string): Promise<Note> {
    return api.get<Note>(`/notes/share?token=${encodeURIComponent(token)}`);
  },
};
