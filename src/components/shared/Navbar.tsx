import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-brand-700 hover:text-brand-900">
              LooseNotes
            </Link>
            {user && (
              <>
                <Link to="/notes" className="text-sm text-gray-600 hover:text-gray-900">My Notes</Link>
                <Link to="/search" className="text-sm text-gray-600 hover:text-gray-900">Search</Link>
                <Link to="/top-rated" className="text-sm text-gray-600 hover:text-gray-900">Top Rated</Link>
                {user.role === 'admin' && (
                  <Link to="/admin" className="text-sm text-red-600 hover:text-red-800 font-medium">Admin</Link>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link to="/profile" className="text-sm text-gray-600 hover:text-gray-900">
                  {/* Display username via React's default JSX escaping — no dangerouslySetInnerHTML */}
                  {user.username}
                </Link>
                <button
                  onClick={() => void handleLogout()}
                  className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Log in</Link>
                <Link
                  to="/register"
                  className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
