import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/shared/ErrorBoundary';
import Layout from './components/shared/Layout';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotesPage from './pages/NotesPage';
import NoteDetailPage from './pages/NoteDetailPage';
import CreateNotePage from './pages/CreateNotePage';
import EditNotePage from './pages/EditNotePage';
import ProfilePage from './pages/ProfilePage';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
import AdminPage from './pages/AdminPage';
import TopRatedPage from './pages/TopRatedPage';
import SharePage from './pages/SharePage';
import SearchPage from './pages/SearchPage';
import DiagnosticsPage from './pages/DiagnosticsPage';

/** Route guard: redirects to /login if not authenticated. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Route guard: redirects to /notes if not admin. */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/notes" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<PasswordRecoveryPage />} />
        <Route path="/top-rated" element={<TopRatedPage />} />
        <Route path="/share/:token" element={<SharePage />} />

        {/* Authenticated routes */}
        <Route path="/notes" element={<RequireAuth><NotesPage /></RequireAuth>} />
        <Route path="/notes/new" element={<RequireAuth><CreateNotePage /></RequireAuth>} />
        <Route path="/notes/:id" element={<RequireAuth><NoteDetailPage /></RequireAuth>} />
        <Route path="/notes/:id/edit" element={<RequireAuth><EditNotePage /></RequireAuth>} />
        <Route path="/search" element={<RequireAuth><SearchPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/diagnostics" element={<RequireAuth><DiagnosticsPage /></RequireAuth>} />

        {/* Admin routes */}
        <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
