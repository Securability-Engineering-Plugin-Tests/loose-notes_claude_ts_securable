import type React from 'react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import ErrorBanner from '../components/ErrorBanner';

export default function NewNotePage(): React.ReactElement {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const note = await api.createNote({ title, content, isPublic });
      navigate(`/notes/${note.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
      else setError({ message: 'Could not create note' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto card p-6">
      <h1 className="text-xl font-semibold mb-4">New note</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="title" className="label">Title</label>
          <input id="title" className="input" required maxLength={200}
            value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="content" className="label">Content</label>
          <textarea id="content" className="input min-h-[12rem]" maxLength={40000}
            value={content} onChange={(e) => setContent(e.target.value)} />
          <p className="text-xs text-slate-500 mt-1">Plain text. HTML and scripts are stripped on save.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Make this note public
        </label>
        <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create note'}
        </button>
      </form>
    </div>
  );
}
