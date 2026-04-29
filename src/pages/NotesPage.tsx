import type React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { ApiNote } from '../types';
import NoteCard from '../components/NoteCard';
import ErrorBanner from '../components/ErrorBanner';

export default function NotesPage(): React.ReactElement {
  const [items, setItems] = useState<ApiNote[]>([]);
  const [filter, setFilter] = useState<'all' | 'mine' | 'public'>('mine');
  const [q, setQ] = useState('');
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.searchNotes({ q, filter, limit: 30 })
      .then((res) => { if (!cancelled) setItems(res.items); })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
        else setError({ message: 'Could not load notes' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Notes</h1>
        <Link to="/notes/new" className="btn-primary">New note</Link>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="input flex-1" placeholder="Search…"
          value={q} onChange={(e) => setQ(e.target.value)} maxLength={200}
        />
        <select className="input w-40" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'mine' | 'public')}>
          <option value="mine">My notes</option>
          <option value="public">Public notes</option>
          <option value="all">Everything visible</option>
        </select>
      </div>

      <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm">No notes match the current filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((n) => <NoteCard key={n.id} note={n} />)}
        </div>
      )}
    </div>
  );
}
