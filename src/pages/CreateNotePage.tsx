import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { noteService } from '../services/noteService';
import { ApiError } from '../services/api';

const CreateNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(50_000),
  isPublic: z.boolean().default(false),
});
type CreateNoteData = z.infer<typeof CreateNoteSchema>;

export default function CreateNotePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateNoteData>({
    resolver: zodResolver(CreateNoteSchema),
    defaultValues: { isPublic: false },
  });

  const onSubmit = async (data: CreateNoteData) => {
    setServerError(null);
    try {
      const note = await noteService.create(data);
      navigate(`/notes/${encodeURIComponent(note.id)}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Failed to create note.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create a note</h1>

      {serverError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{serverError}</div>
      )}

      <form onSubmit={void handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            id="title"
            type="text"
            {...register('title')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">Content</label>
          <textarea
            id="content"
            {...register('content')}
            rows={12}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
          />
          {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content.message}</p>}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('isPublic')} className="rounded" />
          Make this note public
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2 rounded text-sm font-medium"
          >
            {isSubmitting ? 'Saving…' : 'Create note'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/notes')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
