import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { NotesPage } from '@/pages/notes/NotesPage';
import { NoteCreatePage } from '@/pages/notes/NoteCreatePage';
import { NoteDetailPage } from '@/pages/notes/NoteDetailPage';
import { NoteEditPage } from '@/pages/notes/NoteEditPage';
import { SearchPage } from '@/pages/notes/SearchPage';
import { TopRatedPage } from '@/pages/notes/TopRatedPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { ShareViewPage } from '@/pages/share/ShareViewPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'top-rated', element: <TopRatedPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'share/:token', element: <ShareViewPage /> },

      // Auth-required routes
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'notes', element: <NotesPage /> },
          { path: 'notes/new', element: <NoteCreatePage /> },
          { path: 'notes/:id', element: <NoteDetailPage /> },
          { path: 'notes/:id/edit', element: <NoteEditPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },

      // Admin-only routes
      {
        element: <ProtectedRoute requireAdmin />,
        children: [
          { path: 'admin', element: <AdminDashboardPage /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
