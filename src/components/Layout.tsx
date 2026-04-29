import type React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Layout(): React.ReactElement {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async (): Promise<void> => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold text-brand-600">LooseNotes</Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink to="/" end className={navClass}>Home</NavLink>
            {user && <NavLink to="/notes" className={navClass}>My Notes</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin" className={navClass}>Admin</NavLink>}
            {user ? (
              <>
                <NavLink to="/profile" className={navClass}>{user.username}</NavLink>
                <button type="button" className="btn-secondary" onClick={onLogout}>Sign out</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>Sign in</NavLink>
                <NavLink to="/register" className="btn-primary">Sign up</NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        LooseNotes — securable demo · Engineered with FIASSE v1.0.4 SSEM constraints
      </footer>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }): string {
  return [
    'text-slate-600 hover:text-slate-900',
    isActive ? 'font-medium text-slate-900' : '',
  ].join(' ');
}
