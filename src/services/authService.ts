import { apiRequest, setMemoryToken } from './api';
import type { User, AuthSession } from '@/types';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  const result = await apiRequest<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });

  if (!result.ok) throw new ApiError(result.error);

  // Store token in memory for Authorization header (belt-and-suspenders with cookie)
  setMemoryToken(result.data.token);
  return result.data;
}

export async function register(data: RegisterData): Promise<AuthSession> {
  const result = await apiRequest<AuthSession>('/api/auth/register', {
    method: 'POST',
    body: data,
  });

  if (!result.ok) throw new ApiError(result.error);

  setMemoryToken(result.data.token);
  return result.data;
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
  setMemoryToken(null);
}

export async function getCurrentUser(): Promise<User> {
  const result = await apiRequest<User>('/api/auth/me');
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

export async function forgotPassword(email: string): Promise<void> {
  const result = await apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
  if (!result.ok) throw new ApiError(result.error);
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const result = await apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
  if (!result.ok) throw new ApiError(result.error);
}

// Typed error class for service-layer errors (Resilience — specific exception types)
export class ApiError extends Error {
  constructor(
    public readonly error: { code: string; message: string; fieldErrors?: Record<string, string[]> }
  ) {
    super(error.message);
    this.name = 'ApiError';
  }
}
