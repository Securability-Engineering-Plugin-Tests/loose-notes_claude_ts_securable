import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { noteService } from '../services/noteService';
import type { Note } from '../types';
import { ApiError } from '../services/api';

const TAG_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'general', label: 'General' },
  { value: 'technology', label: 'Technology' },
  { value: 'science', label: 'Science' },
  { value: 'arts', label: 'Arts' },
  { value: 'other', label: 'Other' },
] as const;

type TagOption = typeof TAG_OPTIONS[number]['value'];

export default function TopRatedPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedTag, setSelectedTag] = useState<TagOption>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    void noteService.getTopRated({
      tag: selectedTag || undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then(result => {
      setNotes(result.items);
      setTotal(result.total);
    }).catch(err => {
      setError(err instanceof ApiError ? err.message : 'Failed to load top-rated notes.');
    }).finally(() => setIsLoading(false));
  }, [page, selectedTag]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Top Rated Notes</h1>
        <div>
          {/* Tag filter uses an allowlisted enum — not raw user input */}
          <select
            value={selectedTag}
            onChange={e => { setSelectedTag(e.target.value as TagOption); setPage(1); }}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          >
            {TAG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No rated notes yet.</div>
      ) : (
        <div className="space-y-2">
          {notes.map((note, i) => (
            <div key={note.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
              <div className="text-2xl font-bold text-gray-200 w-8 text-center">{(page - 1) * PAGE_SIZE + i + 1}</div>
              <div className="flex-1 min-w-0">
                {/* title JSX-escaped */}
                <Link to={`/notes/${encodeURIComponent(note.id)}`} className="font-medium text-gray-900 hover:text-brand-700 truncate block">
                  {note.title}
                </Link>
                <p className="text-xs text-gray-400 mt-0.5">by {note.ownerUsername}</p>
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold text-yellow-600">
                  ★ {note.averageRating !== undefined ? note.averageRating.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-gray-400">{note.ratingCount ?? 0} ratings</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Previous</button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
