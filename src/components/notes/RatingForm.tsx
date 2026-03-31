import { useState } from 'react';
import { StarRating } from '@/components/ui/StarRating';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

interface RatingFormProps {
  initialValue?: number;
  initialComment?: string;
  onSubmit: (value: 1 | 2 | 3 | 4 | 5, comment?: string) => Promise<void>;
  isLoading?: boolean;
}

export function RatingForm({ initialValue = 0, initialComment = '', onSubmit, isLoading }: RatingFormProps) {
  const [value, setValue] = useState<1 | 2 | 3 | 4 | 5 | 0>(initialValue as 1 | 2 | 3 | 4 | 5 | 0);
  const [comment, setComment] = useState(initialComment);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (value === 0) {
      setError('Please select a rating');
      return;
    }
    setError(null);
    await onSubmit(value as 1 | 2 | 3 | 4 | 5, comment || undefined);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
        <StarRating value={value} onChange={setValue} size="lg" />
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
      <Textarea
        label="Comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Add a comment..."
      />
      <Button type="submit" isLoading={isLoading}>Submit Rating</Button>
    </form>
  );
}
