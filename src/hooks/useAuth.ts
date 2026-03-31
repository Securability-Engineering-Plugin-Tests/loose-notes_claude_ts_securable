// Authentication hook — centralizes auth state access and side effects
// Testability: hook isolates auth logic from components

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated, selectIsAdmin } from '@/store/authStore';
import { getCurrentUser } from '@/services/authService';
import { logger } from '@/utils/logger';

/** Initialize auth state from server on app load */
export function useAuthInit(): void {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function initAuth(): Promise<void> {
      setLoading(true);
      try {
        const user = await getCurrentUser();
        if (!cancelled) {
          // Token from persisted store is already set via onRehydrateStorage
          const token = useAuthStore.getState().token ?? '';
          setAuth(user, token);
        }
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      }
    }

    void initAuth();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Redirect unauthenticated users to login */
export function useRequireAuth(redirectTo = '/login'): void {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      logger.securityEvent('auth.redirect', 'failure', { reason: 'unauthenticated', redirectTo });
      void navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);
}

/** Redirect non-admin users to home */
export function useRequireAdmin(): void {
  const isAdmin = useAuthStore(selectIsAdmin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      logger.securityEvent('auth.redirect', 'failure', { reason: 'not_admin' });
      void navigate('/', { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);
}
