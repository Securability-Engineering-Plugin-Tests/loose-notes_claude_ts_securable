import { api, setCsrfToken, clearCsrfToken } from './api';
import type { User, AuthResponse } from '../types';

export const authService = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', { username, password });
    setCsrfToken(response.csrfToken);
    return response;
  },

  async register(data: {
    username: string;
    email: string;
    password: string;
    securityQuestion: string;
    securityAnswer: string;
  }): Promise<{ userId: string }> {
    return api.post('/auth/register', data);
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
    clearCsrfToken();
  },

  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string; securityQuestion?: string }> {
    return api.post('/auth/forgot-password', { email });
  },

  async resetPassword(data: {
    token: string;
    securityAnswer: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string }> {
    return api.post('/auth/reset-password', data);
  },

  async getProfile(): Promise<User> {
    return api.get<User>('/profile');
  },

  async updateProfile(data: {
    email?: string;
    currentPassword: string;
    newPassword?: string;
    confirmPassword?: string;
  }): Promise<{ message: string }> {
    return api.put('/profile', data);
  },
};
