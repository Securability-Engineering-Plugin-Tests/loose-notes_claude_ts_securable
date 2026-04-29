import type React from 'react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import ErrorBanner from '../components/ErrorBanner';

export default function RegisterPage(): React.ReactElement {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError({ message: 'Password must be at least 12 characters' });
      return;
    }
    setSubmitting(true);
    try {
      await register({ username, email, password });
      navigate('/notes', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
      else setError({ message: 'Registration failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto card p-6">
      <h1 className="text-xl font-semibold mb-4">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="username" className="label">Username</label>
          <input
            id="username" className="input" autoComplete="username"
            value={username} onChange={(e) => setUsername(e.target.value)}
            required minLength={3} maxLength={32}
          />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email" type="email" className="input" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            required maxLength={254}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password" type="password" className="input" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={12} maxLength={256}
          />
          <p className="text-xs text-slate-500 mt-1">At least 12 characters. Long passphrases beat complex jumbles.</p>
        </div>
        <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <div className="mt-4 text-sm text-slate-600">
        <Link to="/login" className="text-brand-600 hover:underline">Already have an account? Sign in</Link>
      </div>
    </div>
  );
}
