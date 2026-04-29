import type React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/**
 * Client-side route gate.
 *
 * SECURITY NOTE: This is a UX gate, NOT an authorization control. The actual
 * authorization decision is made server-side on every API call. This guard
 * exists only so the SPA does not flash a protected page before redirecting.
 */
export default function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
