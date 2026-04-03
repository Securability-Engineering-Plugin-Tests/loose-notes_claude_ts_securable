import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { noteService } from '../services/noteService';
import { ApiError } from '../services/api';

const EditNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(50_000),
  isPublic: z.boolean(),
});
type EditNoteData = z.infer<typeof EditNoteSchema>;

export default function EditNotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EditNoteData>({
    resolver: zodResolver(EditNoteSchema),
  });

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const note = await noteService.get(id);
        reset({ title: note.title, content: note.content, isPublic: note.isPublic });
        setIsLoaded(true);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load note.');
      }
    })();
  }, [id, reset]);

  const onSubmit = async (data: EditNoteData) => {
    if (!id) return;
    setServerError(null);
    try {
      await noteService.update(id, data);
      navigate(`/notes/${encodeURIComponent(id)}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Update failed.');
    }
  };

  if (loadError) return <div className="p-4 bg-red-50 text-red-700 rounded">{loadError}</div>;
  if (!isLoaded) return <div className="text-center text-gray-400 py-12">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit note</h1>

      {serverError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{serverError}</div>
      )}

      <form onSubmit={void handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input id="title" type="text" {...register('title')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">Content</label>
          <textarea id="content" {...register('content')} rows={12} className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y" />
          {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content.message}</p>}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('isPublic')} className="rounded" />
          Make this note public
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2 rounded text-sm font-medium">
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={() => navigate(`/notes/${encodeURIComponent(id ?? '')}`)} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
