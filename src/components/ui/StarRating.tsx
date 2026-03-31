import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/utils/cn';

interface StarRatingProps {
  value: number;
  onChange?: (value: 1 | 2 | 3 | 4 | 5) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const effective = hovered || value;

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${value} out of 5`}>
      {([1, 2, 3, 4, 5] as const).map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={cn(
            'transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
          )}
          aria-label={`Rate ${star} out of 5`}
        >
          <Star
            className={cn(
              sizeMap[size],
              effective >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            )}
          />
        </button>
      ))}
    </div>
  );
}
