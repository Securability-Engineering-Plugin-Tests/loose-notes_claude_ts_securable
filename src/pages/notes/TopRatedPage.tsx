import { useEffect } from 'react';
import { Star } from 'lucide-react';
import { NoteCard } from '@/components/notes/NoteCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { useApi } from '@/hooks/useApi';
import { getTopRatedNotes } from '@/services/notesService';

export function TopRatedPage() {
  const { data: notes, isLoading, error, execute } = useApi(getTopRatedNotes);

  useEffect(() => { void execute(); }, [execute]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
        <h1 className="text-2xl font-bold text-gray-900">Top Rated Notes</h1>
      </div>
      <p className="text-gray-600 text-sm mb-6">Public notes with at least 3 ratings, sorted by average rating.</p>

      {isLoading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}
      {error && <Alert variant="error">{error}</Alert>}

      {!isLoading && notes && (
        notes.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No top-rated notes yet. Rate some notes to see them here!</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => <NoteCard key={note.id} note={note} showOwner />)}
          </div>
        )
      )}
    </div>
  );
}
