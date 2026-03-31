// Generic async API hook — Testability: reusable, injectable loading/error state

import { useState, useCallback, useRef } from 'react';

interface ApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface UseApiResult<T, Args extends unknown[]> extends ApiState<T> {
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
}

/**
 * Wraps an async function with loading/error state management.
 * Automatically cancels in-flight requests when component unmounts.
 */
export function useApi<T, Args extends unknown[]>(
  asyncFn: (...args: Args) => Promise<T>
): UseApiResult<T, Args> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const mountedRef = useRef(true);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState({ data: null, isLoading: true, error: null });

      try {
        const result = await asyncFn(...args);
        if (mountedRef.current) {
          setState({ data: result, isLoading: false, error: null });
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        if (mountedRef.current) {
          setState({ data: null, isLoading: false, error: message });
        }
        return null;
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
