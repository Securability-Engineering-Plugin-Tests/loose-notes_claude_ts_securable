import { apiRequest } from './api';
import { ApiError } from './authService';
import type { Rating } from '@/types';

export async function submitRating(noteId: string, value: number, comment?: string): Promise<Rating> {
  const result = await apiRequest<Rating>(`/api/ratings/${encodeURIComponent(noteId)}`, {
    method: 'POST',
    body: { value, comment },
  });
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}
