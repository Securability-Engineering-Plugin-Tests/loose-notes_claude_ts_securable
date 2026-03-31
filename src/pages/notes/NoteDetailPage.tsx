import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit2, Trash2, Share2, Lock, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StarRating } from '@/components/ui/StarRating';
import { RatingForm } from '@/components/notes/RatingForm';
import { useAuthStore, selectIsAdmin } from '@/store/authStore';
import { useToast } from '@/store/toastStore';
import { getNoteById, deleteNote, generateShareLink, revokeShareLink } from '@/services/notesService';
import { submitRating } from '@/services/ratingsService';
import { ApiError } from '@/services/authService';
import type { Note } from '@/types';

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore(selectIsAdmin);

  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getNoteById(id)
      .then(setNote)
      .catch((err) => setError(err instanceof ApiError ? err.error.message : 'Failed to load note'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const isOwner = user?.id === note?.ownerId;
  const canEdit = isOwner || isAdmin;

  async function handleDelete(): Promise<void> {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteNote(id);
      toast.success('Note deleted');
      void navigate('/notes');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.error.message : 'Failed to delete note');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }

  async function handleGenerateShare(): Promise<void> {
    if (!id) return;
    try {
      const token = await generateShareLink(id);
      setShareToken(token);
      toast.success('Share link generated!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.error.message : 'Failed to generate share link');
    }
  }

  async function handleRevokeShare(): Promise<void> {
    if (!id) return;
    try {
      await revokeShareLink(id);
      setShareToken(null);
      toast.success('Share link revoked');
      setShowShareModal(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.error.message : 'Failed to revoke link');
    }
  }

  async function handleRating(value: 1 | 2 | 3 | 4 | 5, comment?: string): Promise<void> {
    if (!id) return;
    try {
      await submitRating(id, value, comment);
      toast.success('Rating submitted!');
      setShowRatingModal(false);
      const updated = await getNoteById(id);
      setNote(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.error.message : 'Failed to submit rating');
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!note) return <Alert variant="error">Note not found</Alert>;

  const userRating = user ? note.ratings.find((r) => r.userId === user.id) : undefined;
  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 flex-1">{note.title}</h1>
          <Badge variant={note.visibility === 'public' ? 'success' : 'default'}>
            {note.visibility === 'public' ? <Globe className="w-3 h-3 inline mr-1" /> : <Lock className="w-3 h-3 inline mr-1" />}
            {note.visibility}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span>By {note.ownerUsername}</span>
          <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
          {note.averageRating !== null && (
            <span className="flex items-center gap-1">
              <StarRating value={Math.round(note.averageRating)} readonly size="sm" />
              {note.averageRating.toFixed(1)} ({note.ratingCount})
            </span>
          )}
        </div>

        <div className="prose max-w-none text-gray-700 whitespace-pre-wrap mb-6 border-t pt-4">
          {note.content}
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {canEdit && (
            <>
              <Link to={`/notes/${note.id}/edit`}>
                <Button variant="secondary" size="sm"><Edit2 className="w-4 h-4" /> Edit</Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={() => setShowShareModal(true)}>
                <Share2 className="w-4 h-4" /> Share
              </Button>
              <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </>
          )}
          {user && (
            <Button variant="ghost" size="sm" onClick={() => setShowRatingModal(true)}>
              ★ {userRating ? 'Edit rating' : 'Rate this note'}
            </Button>
          )}
        </div>
      </div>

      {note.ratings.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Ratings ({note.ratingCount})</h2>
          <div className="space-y-4">
            {note.ratings.map((r) => (
              <div key={r.id} className="border-b pb-4 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <StarRating value={r.value} readonly size="sm" />
                  <span className="text-sm font-medium">{r.username}</span>
                  <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Note">
        <p className="text-gray-600 mb-4">Are you sure you want to delete "{note.title}"? This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => void handleDelete()} isLoading={isDeleting}>Delete</Button>
        </div>
      </Modal>

      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Note">
        {shareUrl ? (
          <div className="space-y-4">
            <Alert variant="success">Share link generated!</Alert>
            <div className="bg-gray-50 rounded p-3 text-sm break-all font-mono">{shareUrl}</div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(shareUrl)}>Copy link</Button>
              <Button variant="danger" size="sm" onClick={() => void handleRevokeShare()}>Revoke link</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">Generate a shareable link that anyone can use to view this note.</p>
            <Button onClick={() => void handleGenerateShare()}>Generate share link</Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showRatingModal} onClose={() => setShowRatingModal(false)} title={userRating ? 'Edit Rating' : 'Rate This Note'}>
        <RatingForm
          initialValue={userRating?.value ?? 0}
          initialComment={userRating?.comment ?? ''}
          onSubmit={handleRating}
        />
      </Modal>
    </div>
  );
}
