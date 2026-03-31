import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { NoteCard } from '@/components/notes/NoteCard';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { useApi } from '@/hooks/useApi';
import { getMyNotes } from '@/services/notesService';

export function NotesPage() {
  const { data: notes, isLoading, error, execute } = useApi(getMyNotes);

  useEffect(() => { void execute(); }, [execute]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
        <Link to="/notes/new">
          <Button size="sm"><Plus className="w-4 h-4" /> New Note</Button>
        </Link>
      </div>

      {isLoading && <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>}
      {error && <Alert variant="error">{error}</Alert>}

      {!isLoading && !error && notes && (
        notes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="mb-4">You haven't created any notes yet.</p>
            <Link to="/notes/new"><Button variant="secondary">Create your first note</Button></Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => <NoteCard key={note.id} note={note} />)}
          </div>
        )
      )}
    </div>
  );
}
