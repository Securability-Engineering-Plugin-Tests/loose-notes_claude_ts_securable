// Authentication state store — Zustand
// Analyzability: single-purpose store, clear state shape
// Modifiability: business logic stays in services, store is state-only

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { setMemoryToken } from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (patch: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,

      setAuth: (user, token) => {
        setMemoryToken(token);
        set({ user, token, isLoading: false });
      },

      clearAuth: () => {
        setMemoryToken(null);
        set({ user: null, token: null, isLoading: false });
      },

      setLoading: (isLoading) => set({ isLoading }),

      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        })),
    }),
    {
      name: 'loose-notes-auth',
      // Only persist non-sensitive fields — token persistence is belt-and-suspenders
      // Primary auth is httpOnly cookie; this just prevents flicker on reload
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        // Restore memory token from persisted state on page load
        if (state?.token) {
          setMemoryToken(state.token);
        }
        state?.setLoading(false);
      },
    }
  )
);

// Derived selectors (keep components thin)
export const selectIsAuthenticated = (state: AuthState) => state.user !== null;
export const selectIsAdmin = (state: AuthState) => state.user?.role === 'admin';
export const selectUser = (state: AuthState) => state.user;
