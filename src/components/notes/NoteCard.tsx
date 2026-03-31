import { Link } from 'react-router-dom';
import { Lock, Globe, Star, Calendar, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import type { NoteListItem } from '@/types';

interface NoteCardProps {
  note: NoteListItem;
  showOwner?: boolean;
}

export function NoteCard({ note, showOwner = false }: NoteCardProps) {
  const isPublic = note.visibility === 'public';

  return (
    <article className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          to={`/notes/${note.id}`}
          className="text-gray-900 font-semibold hover:text-primary-700 line-clamp-2 flex-1"
        >
          {note.title}
        </Link>
        <Badge variant={isPublic ? 'success' : 'default'}>
          {isPublic ? <Globe className="w-3 h-3 inline mr-1" /> : <Lock className="w-3 h-3 inline mr-1" />}
          {isPublic ? 'Public' : 'Private'}
        </Badge>
      </div>

      {note.excerpt && (
        <p className="text-gray-600 text-sm line-clamp-3 mb-3">{note.excerpt}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500">
        {showOwner && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {note.ownerUsername}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
        </span>
        {note.averageRating !== null && (
          <span className="flex items-center gap-1 text-yellow-600">
            <Star className="w-3 h-3 fill-yellow-400" />
            {note.averageRating.toFixed(1)} ({note.ratingCount})
          </span>
        )}
      </div>
    </article>
  );
}
