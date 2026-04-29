import type React from 'react';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import ErrorBanner from '../components/ErrorBanner';

export default function ProfilePage(): React.ReactElement {
  const { user, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.profile().then((u) => { if (!cancelled) setEmail(u.email); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const patch: { email?: string; currentPassword?: string; newPassword?: string } = {};
      if (email && email !== user?.email) patch.email = email;
      if (newPassword) {
        patch.currentPassword = currentPassword;
        patch.newPassword = newPassword;
      }
      if (Object.keys(patch).length === 0) {
        setInfo('Nothing to change.');
        return;
      }
      await api.updateProfile(patch);
      await refresh();
      setInfo('Profile updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto card p-6">
      <h1 className="text-xl font-semibold mb-4">Profile</h1>
      <p className="text-sm text-slate-500 mb-4">Signed in as <span className="font-medium">{user?.username}</span> · role: {user?.role}</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required maxLength={254}
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <hr className="my-2" />
        <p className="text-sm text-slate-600">Change password (optional)</p>
        <div>
          <label className="label">Current password</label>
          <input className="input" type="password" autoComplete="current-password"
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">New password</label>
          <input className="input" type="password" autoComplete="new-password" minLength={12}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />
        {info && <div className="text-sm text-emerald-700">{info}</div>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
