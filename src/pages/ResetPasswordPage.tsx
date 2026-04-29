import type React from 'react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import ErrorBanner from '../components/ErrorBanner';

export default function ResetPasswordPage(): React.ReactElement {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onRequest = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.resetRequest(email);
      setInfo(res.message);
      if (res.devToken) setDevToken(res.devToken);
      setStep('confirm');
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
    } finally {
      setSubmitting(false);
    }
  };

  const onConfirm = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.resetConfirm(token, newPassword);
      setInfo(res.message);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto card p-6">
      <h1 className="text-xl font-semibold mb-4">Reset password</h1>
      {step === 'request' ? (
        <form onSubmit={onRequest} className="space-y-3">
          <p className="text-sm text-slate-600">
            Enter your email. If it matches an account, we&apos;ll issue a one-time reset token.
          </p>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required maxLength={254}
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset token'}
          </button>
        </form>
      ) : (
        <form onSubmit={onConfirm} className="space-y-3">
          <div className="text-sm text-emerald-700">{info}</div>
          {devToken && (
            <div className="text-xs bg-amber-100 border border-amber-300 p-2 rounded break-all">
              <strong>Dev mode:</strong> token: <code>{devToken}</code>
            </div>
          )}
          <div>
            <label className="label">Reset token</label>
            <input className="input" required minLength={20} maxLength={256}
              value={token} onChange={(e) => setToken(e.target.value)} />
          </div>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" required minLength={12} maxLength={256}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Confirming…' : 'Set new password'}
          </button>
        </form>
      )}
      <div className="mt-4 text-sm">
        <Link to="/login" className="text-brand-600 hover:underline">Back to sign in</Link>
      </div>
    </div>
  );
}
