// Form validation hook — integrates Zod schemas with React state
// Implements canonicalize → sanitize → validate for client-side forms

import { useState, useCallback } from 'react';
import { z, ZodType } from 'zod';

type FieldErrors<T> = Partial<Record<keyof T, string>>;

interface FormValidationResult<T> {
  errors: FieldErrors<T>;
  validate: (data: unknown) => T | null;
  setFieldError: (field: keyof T, message: string) => void;
  clearErrors: () => void;
  clearFieldError: (field: keyof T) => void;
}

/**
 * Provides Zod-based form validation with per-field error state.
 * Returns null from validate() on failure (errors populated in state).
 */
export function useFormValidation<T>(schema: ZodType<T>): FormValidationResult<T> {
  const [errors, setErrors] = useState<FieldErrors<T>>({});

  const validate = useCallback(
    (data: unknown): T | null => {
      const result = schema.safeParse(data);

      if (!result.success) {
        const newErrors: FieldErrors<T> = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof T;
          if (field && !newErrors[field]) {
            newErrors[field] = issue.message;
          }
        }
        setErrors(newErrors);
        return null;
      }

      setErrors({});
      return result.data;
    },
    [schema]
  );

  const setFieldError = useCallback((field: keyof T, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearErrors = useCallback(() => setErrors({}), []);

  const clearFieldError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  return { errors, validate, setFieldError, clearErrors, clearFieldError };
}
