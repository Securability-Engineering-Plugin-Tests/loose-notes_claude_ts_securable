/**
 * Note detail view.
 *
 * SSEM: Integrity — note content rendered via DOMPurify before
 * dangerouslySetInnerHTML. Rating comments rendered via JSX (escaped).
 * PRD §6.2 required direct HTML insertion without encoding.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { noteService } from '../services/noteService';
import { sanitizeNoteContent } from '../utils/sanitization';
import RatingsChart from '../components/charts/RatingsChart';
import type { Note, Rating } from '../types';
import { ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [ratingForm, setRatingForm] = useState({ score: 5, comment: '' });
  const [ratingError, setRatingError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [n, r] = await Promise.all([
          noteService.get(id),
          noteService.getRatings(id),
        ]);
        setNote(n);
        setRatings(r);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load note.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const handleShare = async () => {
    if (!note) return;
    try {
      const result = await noteService.createShareLink(note.id);
      setShareUrl(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate share link.');
    }
  };

  const handleDelete = async () => {
    if (!note || !confirm('Delete this note permanently?')) return;
    try {
      await noteService.delete(note.id);
      navigate('/notes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed.');
    }
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRatingError(null);
    if (!note) return;
    try {
      await noteService.rate(note.id, ratingForm.score, ratingForm.comment);
      const updated = await noteService.getRatings(note.id);
      setRatings(updated);
      setRatingForm({ score: 5, comment: '' });
    } catch (err) {
      setRatingError(err instanceof ApiError ? err.message : 'Rating failed.');
    }
  };

  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading…</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;
  if (!note) return null;

  const isOwner = user?.id === note.ownerId;

  // Build rating distribution for the chart
  const distribution: Record<number, number> = {};
  ratings.forEach(r => { distribution[r.score] = (distribution[r.score] ?? 0) + 1; });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex justify-between items-start mb-4">
          {/* Title rendered via JSX — HTML-escaped */}
          <h1 className="text-2xl font-bold text-gray-900">{note.title}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${note.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {note.isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        <div className="text-sm text-gray-400 mb-4">
          by {note.ownerUsername} · {new Date(note.createdAt).toLocaleDateString()}
        </div>

        {/* Content: sanitized HTML from DOMPurify before dangerouslySetInnerHTML */}
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: sanitizeNoteContent(note.content) }}
        />

        {isOwner && (
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
            <Link
              to={`/notes/${encodeURIComponent(note.id)}/edit`}
              className="text-sm text-brand-600 hover:underline"
            >
              Edit
            </Link>
            <button onClick={() => void handleShare()} className="text-sm text-brand-600 hover:underline">
              Share
            </button>
            <button onClick={() => void handleDelete()} className="text-sm text-red-500 hover:underline">
              Delete
            </button>
          </div>
        )}

        {shareUrl && (
          <div className="mt-3 p-3 bg-brand-50 border border-brand-200 rounded text-sm">
            Share link: <code className="break-all">{shareUrl}</code>
          </div>
        )}
      </div>

      {/* Ratings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Ratings ({ratings.length})
        </h2>

        {ratings.length > 0 && <RatingsChart distribution={distribution} />}

        <div className="space-y-3 mt-4">
          {ratings.map(r => (
            <div key={r.id} className="border border-gray-100 rounded p-3">
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                {/* username and date rendered via JSX — escaped */}
                <span>{r.username}</span>
                <span>{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</span>
              </div>
              {/* comment rendered via JSX — escaped (PRD §6.2 required raw HTML) */}
              {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
            </div>
          ))}
        </div>

        {user && (
          <form onSubmit={(e) => void handleRate(e)} className="mt-4 space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700">Leave a rating</h3>
            {ratingError && <p className="text-sm text-red-600">{ratingError}</p>}
            <div className="flex items-center gap-2">
              <label htmlFor="score" className="text-sm text-gray-600">Score</label>
              <select
                id="score"
                value={ratingForm.score}
                onChange={e => setRatingForm(f => ({ ...f, score: Number(e.target.value) }))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <textarea
              value={ratingForm.comment}
              onChange={e => setRatingForm(f => ({ ...f, comment: e.target.value.slice(0, 1000) }))}
              placeholder="Optional comment…"
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
            />
            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded text-sm"
            >
              Submit rating
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
