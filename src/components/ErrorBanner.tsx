import type React from 'react';

/**
 * Inline error banner with stable structure.
 *
 * Errors carry an opaque `requestId` so users can quote it to support
 * without us needing to surface stack traces or internal codes.
 * (S2.5 Transparency, S3.2.3.3 Resilience — fail-closed but observably.)
 */
export default function ErrorBanner({ message, requestId }: { message: string; requestId?: string }): React.ReactElement | null {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
      <div>{message}</div>
      {requestId && <div className="text-xs text-red-500 mt-1">Reference: {requestId}</div>}
    </div>
  );
}
