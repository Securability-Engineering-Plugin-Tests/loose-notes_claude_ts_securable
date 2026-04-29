import type React from 'react';
import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import ErrorBanner from '../components/ErrorBanner';

export default function LoginPage(): React.ReactElement {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fallback = (location.state as { from?: string } | null)?.from ?? '/notes';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(fallback, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
      else setError({ message: 'Sign-in failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto card p-6">
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3" autoComplete="on">
        <div>
          <label htmlFor="username" className="label">Username</label>
          <input
            id="username" name="username" className="input" autoComplete="username"
            value={username} onChange={(e) => setUsername(e.target.value)}
            required minLength={3} maxLength={32}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password" name="password" type="password" className="input" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            required maxLength={256}
          />
        </div>
        <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-4 text-sm text-slate-600 flex justify-between">
        <Link to="/register" className="text-brand-600 hover:underline">Create account</Link>
        <Link to="/reset-password" className="text-brand-600 hover:underline">Forgot password?</Link>
      </div>
    </div>
  );
}
