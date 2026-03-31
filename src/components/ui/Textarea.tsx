import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:bg-gray-50 disabled:text-gray-500',
            error ? 'border-red-500' : 'border-gray-300',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
