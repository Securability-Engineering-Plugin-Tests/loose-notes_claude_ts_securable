import { api } from './api';
import type { User, AdminStats } from '../types';

export const adminService = {
  async getStats(): Promise<AdminStats> {
    return api.get<AdminStats>('/admin?action=stats');
  },

  async getUsers(): Promise<User[]> {
    return api.get<User[]>('/admin?action=users');
  },

  async getAllNotes(): Promise<Array<{ id: string; title: string; ownerId: string; isPublic: boolean; createdAt: string }>> {
    return api.get('/admin?action=notes');
  },

  async reassignNote(noteId: string, targetUserId: string): Promise<{ message: string }> {
    return api.post('/admin?action=reassign', { noteId, targetUserId });
  },
};
