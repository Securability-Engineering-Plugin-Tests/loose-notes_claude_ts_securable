import type React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { ApiNote } from '../types';
import NoteCard from '../components/NoteCard';
import ErrorBanner from '../components/ErrorBanner';

interface TopRow { note: ApiNote; avgScore: number; ratingCount: number }

export default function HomePage(): React.ReactElement {
  const [top, setTop] = useState<TopRow[]>([]);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.topNotes(6, 'global')
      .then((rows) => { if (!cancelled) setTop(rows); })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
        else setError({ message: 'Could not load top notes' });
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-8">
      <section className="card p-6 bg-gradient-to-br from-brand-50 to-white">
        <h1 className="text-2xl font-bold text-slate-900">Welcome to LooseNotes</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">
          Securable note sharing — a working demo that takes the LooseNotes specification and
          re-engineers each requirement against the FIASSE v1.0.4 SSEM model. Every endpoint
          enforces server-side ownership, every input is canonicalized at the boundary, and
          every credential is hashed.
        </p>
        <div className="mt-4 flex gap-2">
          <Link to="/register" className="btn-primary">Create an account</Link>
          <Link to="/notes" className="btn-secondary">Browse notes</Link>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Top-rated public notes</h2>
        <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />
        {top.length === 0 ? (
          <p className="text-sm text-slate-500">No rated public notes yet — create one!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {top.map((row) => (
              <div key={row.note.id} className="space-y-1">
                <NoteCard note={row.note} />
                <div className="text-xs text-slate-500 px-1">
                  ★ {row.avgScore.toFixed(2)} · {row.ratingCount} rating{row.ratingCount === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
