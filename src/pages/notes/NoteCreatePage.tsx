import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NoteForm } from '@/components/notes/NoteForm';
import { useToast } from '@/store/toastStore';
import { createNote } from '@/services/notesService';
import { ApiError } from '@/services/authService';
import type { CreateNoteInput } from '@/utils/validation';

export function NoteCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(data: CreateNoteInput): Promise<void> {
    setIsLoading(true);
    try {
      const note = await createNote(data);
      toast.success('Note created!');
      void navigate(`/notes/${note.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.error.message : 'Failed to create note');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Note</h1>
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <NoteForm onSubmit={handleSubmit} isLoading={isLoading} submitLabel="Create Note" />
      </div>
    </div>
  );
}
