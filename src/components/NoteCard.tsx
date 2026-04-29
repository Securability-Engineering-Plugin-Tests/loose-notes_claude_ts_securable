import type React from 'react';
import { Link } from 'react-router-dom';
import type { ApiNote } from '../types';

/**
 * Note display card.
 *
 * SECURITY: Note title and content are rendered as plain text via React's
 * default JSX escaping. We never use dangerouslySetInnerHTML for stored
 * content. Combined with server-side `stripHtml` on storage, this gives
 * defense-in-depth against the PRD §6 "insert directly into rendered HTML"
 * pattern.
 */
export default function NoteCard({ note, to }: { note: ApiNote; to?: string }): React.ReactElement {
  const href = to ?? `/notes/${note.id}`;
  const preview = note.content.length > 240 ? `${note.content.slice(0, 240)}…` : note.content;
  return (
    <Link to={href} className="card p-4 block hover:border-brand-500 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-slate-900 truncate">{note.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${note.isPublic ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
          {note.isPublic ? 'Public' : 'Private'}
        </span>
      </div>
      <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{preview || '(empty)'}</p>
      <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
        <span>{note.ownerUsername ? `by ${note.ownerUsername}` : ''}</span>
        <span>{new Date(note.updatedAt).toLocaleString()}</span>
      </div>
    </Link>
  );
}
