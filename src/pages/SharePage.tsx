import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { noteService } from '../services/noteService';
import { sanitizeNoteContent } from '../utils/sanitization';
import type { Note } from '../types';
import { ApiError } from '../services/api';

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void noteService.getSharedNote(token)
      .then(n => setNote(n))
      .catch(err => setError(err instanceof ApiError ? err.message : 'Note not found or link is invalid.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading…</div>;
  if (error) return (
    <div className="max-w-lg mx-auto mt-16 text-center p-8 bg-red-50 rounded-xl">
      {/* Error message from server JSON response — JSX-escaped */}
      <p className="text-red-700">{error}</p>
    </div>
  );
  if (!note) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
        <div className="text-xs text-gray-400 mb-2">Shared note</div>
        {/* title rendered via JSX — escaped */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{note.title}</h1>
        <p className="text-sm text-gray-400 mb-4">by {note.ownerUsername}</p>
        {/* Content sanitized by DOMPurify before dangerouslySetInnerHTML */}
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: sanitizeNoteContent(note.content) }}
        />
      </div>

      {note.attachments?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Attachments</h2>
          <ul className="space-y-1">
            {note.attachments.map(a => (
              <li key={a.id} className="text-sm text-gray-600">
                {/* originalName rendered via JSX — escaped */}
                {a.originalName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
