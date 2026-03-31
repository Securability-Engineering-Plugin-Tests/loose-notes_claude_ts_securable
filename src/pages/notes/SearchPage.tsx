import { useState } from 'react';
import { Search } from 'lucide-react';
import { NoteCard } from '@/components/notes/NoteCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { searchNotes } from '@/services/notesService';
import { ApiError } from '@/services/authService';
import { sanitizeSearchQuery } from '@/utils/sanitize';
import type { NoteListItem } from '@/types';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    // Canonicalize → sanitize → validate
    const sanitized = sanitizeSearchQuery(query);
    if (!sanitized) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await searchNotes(sanitized);
      setResults(result.items);
      setTotal(result.total);
      setSearched(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.error.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Search Notes</h1>

      <form onSubmit={(e) => void handleSearch(e)} className="flex gap-2 mb-8">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes by title or content..."
          className="flex-1"
          maxLength={200}
        />
        <Button type="submit" isLoading={isLoading}>
          <Search className="w-4 h-4" /> Search
        </Button>
      </form>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {isLoading && <div className="flex justify-center py-8"><LoadingSpinner size="lg" /></div>}

      {searched && !isLoading && (
        <div>
          <p className="text-sm text-gray-600 mb-4">{total} result{total !== 1 ? 's' : ''} for "{query}"</p>
          {results.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No notes found matching your search.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((note) => <NoteCard key={note.id} note={note} showOwner />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
