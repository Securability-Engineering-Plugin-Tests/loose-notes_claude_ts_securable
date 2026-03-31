import { apiRequest } from './api';
import { ApiError } from './authService';
import type { User, AdminDashboardStats } from '@/types';

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const result = await apiRequest<AdminDashboardStats>('/api/admin/dashboard');
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function getUsers(search?: string): Promise<User[]> {
  const params = search ? `?q=${encodeURIComponent(search)}` : '';
  const result = await apiRequest<User[]>(`/api/admin/users${params}`);
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function reassignNote(noteId: string, newOwnerId: string): Promise<void> {
  const result = await apiRequest('/api/admin/reassign', {
    method: 'POST',
    body: { noteId, newOwnerId },
  });
  if (!result.ok) throw new ApiError(result.error);
}
