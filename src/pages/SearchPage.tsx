import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { noteService } from '../services/noteService';
import NoteCard from '../components/notes/NoteCard';
import type { Note } from '../types';
import { ApiError } from '../services/api';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const runSearch = async (q: string, p: number) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await noteService.search(q, p, PAGE_SIZE);
      setNotes(result.notes ?? []);
      setTotal(result.total ?? 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    if (q) {
      setQuery(q);
      void runSearch(q, page);
    }
  }, [searchParams, page]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setPage(1);
    setSearchParams({ q: trimmed });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Search Notes</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search notes…"
          maxLength={200}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm">
          Search
        </button>
      </form>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Searching…</div>
      ) : notes.length > 0 ? (
        <>
          <p className="text-sm text-gray-500 mb-4">{total} result{total !== 1 ? 's' : ''}</p>
          <div className="space-y-3">
            {notes.map(n => <NoteCard key={n.id} note={n} showOwner />)}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Previous</button>
              <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      ) : searchParams.get('q') ? (
        <div className="text-center text-gray-400 py-12">No results found for "{searchParams.get('q')}"</div>
      ) : null}
    </div>
  );
}
