import type React from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { ApiNote } from '../types';
import ErrorBanner from '../components/ErrorBanner';

export default function SharedNotePage(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<ApiNote | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.readShared(token)
      .then((res) => { if (!cancelled) { setNote(res.note); setExpiresAt(res.expiresAt); } })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
        else setError({ message: 'Could not load shared note' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!note) return <ErrorBanner message={error?.message ?? 'Share link not found'} requestId={error?.requestId} />;

  return (
    <article className="card p-6 space-y-3">
      <h1 className="text-2xl font-bold">{note.title}</h1>
      <p className="text-xs text-slate-500">
        Shared by {note.ownerUsername ?? 'unknown'}
        {expiresAt && <> · expires {new Date(expiresAt).toLocaleString()}</>}
      </p>
      <div className="text-slate-800 whitespace-pre-wrap break-words">{note.content || '(empty)'}</div>
    </article>
  );
}
