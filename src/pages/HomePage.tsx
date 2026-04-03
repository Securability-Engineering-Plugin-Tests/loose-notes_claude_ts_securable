import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { noteService } from '../services/noteService';
import NoteCard from '../components/notes/NoteCard';
import type { Note } from '../types';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const [topNotes, setTopNotes] = useState<Note[]>([]);

  useEffect(() => {
    void noteService.getTopRated({ pageSize: 6 }).then(r => setTopNotes(r.items)).catch(() => {});
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">LooseNotes</h1>
        <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
          Create, share, and discover text notes. Rate and comment on community content.
        </p>
        {user ? (
          <Link to="/notes/new" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg text-sm font-medium">
            Create a note
          </Link>
        ) : (
          <div className="flex justify-center gap-4">
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg text-sm font-medium">Get started</Link>
            <Link to="/login" className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg text-sm font-medium">Log in</Link>
          </div>
        )}
      </section>

      {/* Top rated */}
      {topNotes.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Top Rated Notes</h2>
            <Link to="/top-rated" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topNotes.map(note => (
              <NoteCard key={note.id} note={note} showOwner />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
