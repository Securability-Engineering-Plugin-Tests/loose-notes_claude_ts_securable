import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { noteService } from '../services/noteService';
import NoteCard from '../components/notes/NoteCard';
import type { Note } from '../types';
import { ApiError } from '../services/api';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await noteService.list(page, PAGE_SIZE);
      setNotes(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notes.');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note permanently?')) return;
    try {
      await noteService.delete(id);
      await loadNotes();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed.');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
        <Link
          to="/notes/new"
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          + New note
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <p>You haven't created any notes yet.</p>
          <Link to="/notes/new" className="mt-2 inline-block text-brand-600 hover:underline">Create your first note</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <NoteCard key={note.id} note={note} onDelete={() => void handleDelete(note.id)} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
