import type React from 'react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import ErrorBanner from '../components/ErrorBanner';

export default function EditNotePage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.getNote(id)
      .then((res) => {
        if (cancelled) return;
        setTitle(res.note.title);
        setContent(res.note.content);
        setIsPublic(res.note.isPublic);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.updateNote(id, { title, content, isPublic });
      navigate(`/notes/${id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto card p-6">
      <h1 className="text-xl font-semibold mb-4">Edit note</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Title</label>
          <input className="input" required maxLength={200}
            value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Content</label>
          <textarea className="input min-h-[12rem]" maxLength={40000}
            value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Public
        </label>
        <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
