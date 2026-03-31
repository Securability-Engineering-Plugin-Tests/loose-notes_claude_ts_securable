import { apiRequest } from './api';
import { ApiError } from './authService';
import type { User } from '@/types';

export interface UpdateProfileData {
  username: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function getProfile(): Promise<User> {
  const result = await apiRequest<User>('/api/profile');
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function updateProfile(data: UpdateProfileData): Promise<void> {
  const result = await apiRequest('/api/profile', {
    method: 'PUT',
    body: data,
  });
  if (!result.ok) throw new ApiError(result.error);
}
