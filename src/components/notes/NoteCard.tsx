/**
 * SSEM: Integrity — note title and content snippet are rendered via JSX
 * (which HTML-escapes by default). No dangerouslySetInnerHTML here.
 * PRD §6.2 required inserting content directly without encoding.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { Note } from '../../types';

interface NoteCardProps {
  note: Note;
  showOwner?: boolean;
  onDelete?: (id: string) => void;
}

export default function NoteCard({ note, showOwner = false, onDelete }: NoteCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        {/* title is JSX-escaped — safe against stored XSS */}
        <h3 className="text-lg font-medium text-gray-900 truncate">{note.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${note.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {note.isPublic ? 'Public' : 'Private'}
        </span>
      </div>

      {/* Content snippet — JSX-escaped, not rendered as HTML */}
      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
        {note.content.replace(/<[^>]+>/g, '').slice(0, 200)}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          {showOwner && <span>by {note.ownerUsername}</span>}
          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
          {note.averageRating !== undefined && (
            <span>★ {note.averageRating.toFixed(1)} ({note.ratingCount})</span>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/notes/${encodeURIComponent(note.id)}`}
            className="text-brand-600 hover:text-brand-800"
          >
            View
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(note.id)}
              className="text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
