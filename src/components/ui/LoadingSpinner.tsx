import { cn } from '@/utils/cn';

type SpinnerSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-4',
};

export function LoadingSpinner({ size = 'md', className }: { size?: SpinnerSize; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-full border-gray-300 border-t-primary-600 animate-spin',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
