import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { StarRating } from '@/components/ui/StarRating';
import { getSharedNote } from '@/services/notesService';
import { ApiError } from '@/services/authService';
import type { Note } from '@/types';

export function ShareViewPage() {
  const { token } = useParams<{ token: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('Invalid share link'); setIsLoading(false); return; }
    getSharedNote(token)
      .then(setNote)
      .catch((err) => setError(err instanceof ApiError ? err.error.message : 'Failed to load shared note'))
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;
  if (error) return <div className="max-w-xl mx-auto mt-16"><Alert variant="error">{error}</Alert></div>;
  if (!note) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-2 text-primary-600 text-sm mb-4">
          <FileText className="w-4 h-4" />
          <span>Shared note</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">{note.title}</h1>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
          <span>By {note.ownerUsername}</span>
          <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
          {note.averageRating !== null && (
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              {note.averageRating.toFixed(1)} ({note.ratingCount} ratings)
            </span>
          )}
        </div>

        <div className="text-gray-700 whitespace-pre-wrap leading-relaxed border-t pt-4">
          {note.content}
        </div>
      </div>
    </div>
  );
}
