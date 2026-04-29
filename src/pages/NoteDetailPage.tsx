import type React from 'react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { ApiAttachment, ApiNote, ApiRating } from '../types';
import { useAuth } from '../lib/auth';
import RatingChart from '../components/RatingChart';
import ErrorBanner from '../components/ErrorBanner';

export default function NoteDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [note, setNote] = useState<ApiNote | null>(null);
  const [ratings, setRatings] = useState<ApiRating[]>([]);
  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api.getNote(id)
      .then((res) => {
        if (cancelled) return;
        setNote(res.note);
        setRatings(res.ratings);
        setAttachments(res.attachments);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
        else setError({ message: 'Could not load note' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const onRate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!id) return;
    try {
      const r = await api.rateNote({ noteId: id, score, comment });
      setRatings((prev) => [r, ...prev]);
      setComment('');
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
    }
  };

  const onShare = async (): Promise<void> => {
    if (!id) return;
    try {
      const res = await api.shareNote({ noteId: id, ttlMinutes: 60 * 24 });
      const url = new URL(res.sharePath, window.location.origin).toString();
      setShareLink(url);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
    }
  };

  const onDelete = async (): Promise<void> => {
    if (!id) return;
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      await api.deleteNote(id);
      navigate('/notes', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
    }
  };

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!note) return <ErrorBanner message={error?.message ?? 'Note not found'} requestId={error?.requestId} />;

  const isOwner = user?.id === note.ownerId || user?.role === 'admin';

  return (
    <div className="space-y-6">
      <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />

      <article className="card p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{note.title}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {note.ownerUsername ? `by ${note.ownerUsername} · ` : ''}
              {new Date(note.updatedAt).toLocaleString()}
              {note.isPublic ? ' · public' : ' · private'}
            </p>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <Link to={`/notes/${note.id}/edit`} className="btn-secondary">Edit</Link>
              <button type="button" className="btn-danger" onClick={onDelete}>Delete</button>
            </div>
          )}
        </div>
        <div className="text-slate-800 whitespace-pre-wrap break-words">{note.content || '(empty)'}</div>
      </article>

      <section className="card p-4">
        <h2 className="font-semibold mb-2">Attachments</h2>
        {attachments.length === 0 ? (
          <p className="text-sm text-slate-500">No attachments.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span className="truncate">{a.originalName}</span>
                <a className="text-brand-600 hover:underline" href={`/api/attachments/${a.id}`}>Download</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <section className="card p-4 space-y-2">
          <h2 className="font-semibold">Sharing</h2>
          <p className="text-sm text-slate-600">
            Share links use a 256-bit cryptographically random token and expire automatically.
          </p>
          <button type="button" className="btn-secondary" onClick={onShare}>
            Generate share link (24h)
          </button>
          {shareLink && (
            <div className="text-xs bg-slate-100 p-2 rounded break-all select-all">{shareLink}</div>
          )}
        </section>
      )}

      <section className="card p-4 space-y-4">
        <h2 className="font-semibold">Ratings &amp; comments</h2>
        <RatingChart ratings={ratings} />
        {user && (
          <form onSubmit={onRate} className="space-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor="score" className="text-sm">Score</label>
              <select id="score" className="input w-24" value={score} onChange={(e) => setScore(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <textarea
              className="input"
              placeholder="Comment (optional)"
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="submit" className="btn-primary">Submit rating</button>
          </form>
        )}
        <ul className="divide-y divide-slate-200">
          {ratings.map((r) => (
            <li key={r.id} className="py-2">
              <div className="text-sm">
                <span className="font-medium">{'★'.repeat(r.score)}</span>
                <span className="text-slate-500 ml-2">{r.raterUsername ?? 'anonymous'}</span>
                <span className="text-slate-400 text-xs ml-2">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              {r.comment && <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{r.comment}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
