import { Link, useNavigate } from 'react-router-dom';
import { LogOut, FileText, Search, Star, Shield, User } from 'lucide-react';
import { useAuthStore, selectIsAuthenticated, selectIsAdmin } from '@/store/authStore';
import { logout } from '@/services/authService';
import { useToast } from '@/store/toastStore';
import { logger } from '@/utils/logger';

export function Navbar() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isAdmin = useAuthStore(selectIsAdmin);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const toast = useToast();

  async function handleLogout(): Promise<void> {
    try {
      await logout();
      clearAuth();
      logger.securityEvent('user.logout', 'success', { userId: user?.id });
      void navigate('/login');
    } catch {
      toast.error('Logout failed');
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary-700 text-lg">
            <FileText className="w-5 h-5" />
            Loose Notes
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link to="/notes" className="text-sm text-gray-600 hover:text-primary-700 flex items-center gap-1">
                  <FileText className="w-4 h-4" /> Notes
                </Link>
                <Link to="/search" className="text-sm text-gray-600 hover:text-primary-700 flex items-center gap-1">
                  <Search className="w-4 h-4" /> Search
                </Link>
                <Link to="/top-rated" className="text-sm text-gray-600 hover:text-primary-700 flex items-center gap-1">
                  <Star className="w-4 h-4" /> Top Rated
                </Link>
                {isAdmin && (
                  <Link to="/admin" className="text-sm text-primary-700 font-medium flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Admin
                  </Link>
                )}
                <Link to="/profile" className="text-sm text-gray-600 hover:text-primary-700 flex items-center gap-1">
                  <User className="w-4 h-4" /> {user?.username}
                </Link>
                <button
                  onClick={() => void handleLogout()}
                  className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-primary-700">Login</Link>
                <Link to="/register" className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded-md hover:bg-primary-700">Register</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
