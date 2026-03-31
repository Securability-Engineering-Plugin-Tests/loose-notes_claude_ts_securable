import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NoteForm } from '@/components/notes/NoteForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/store/toastStore';
import { getNoteById, updateNote } from '@/services/notesService';
import { ApiError } from '@/services/authService';
import type { Note } from '@/types';
import type { CreateNoteInput } from '@/utils/validation';

export function NoteEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getNoteById(id)
      .then(setNote)
      .catch((err) => setError(err instanceof ApiError ? err.error.message : 'Failed to load note'))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleSubmit(data: CreateNoteInput): Promise<void> {
    if (!id) return;
    setIsSaving(true);
    try {
      await updateNote(id, data);
      toast.success('Note updated!');
      void navigate(`/notes/${id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.error.message : 'Failed to update note');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!note) return <Alert variant="error">Note not found</Alert>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Note</h1>
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <NoteForm
          initialValues={{ title: note.title, content: note.content, visibility: note.visibility }}
          onSubmit={handleSubmit}
          isLoading={isSaving}
          submitLabel="Update Note"
        />
      </div>
    </div>
  );
}
