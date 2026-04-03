/**
 * Authentication context.
 *
 * SSEM: Authenticity — user identity is sourced from the server (API call),
 * not from localStorage or a client cookie value.
 * SSEM: Confidentiality — only the safe User type (no passwordHash) is stored here.
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User } from '../types';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true });

  // Attempt to load profile on mount (verifies server-side session validity)
  const refreshProfile = useCallback(async () => {
    try {
      const user = await authService.getProfile();
      setState({ user, isLoading: false });
    } catch {
      setState({ user: null, isLoading: false });
    }
  }, []);

  React.useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await authService.login(username, password);
    setState({ user: response.user, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({ user: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
