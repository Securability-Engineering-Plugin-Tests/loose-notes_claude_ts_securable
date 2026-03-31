import { RouterProvider } from 'react-router-dom';
import { useAuthInit } from '@/hooks/useAuth';
import { router } from '@/router';

// Initialize auth state from server on mount (Authenticity — verify token on load)
function AppInner() {
  useAuthInit();
  return <RouterProvider router={router} />;
}

export function App() {
  return <AppInner />;
}
