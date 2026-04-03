import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../services/authService';
import { ApiError } from '../services/api';

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the name of your elementary school?",
  "What is your oldest sibling's middle name?",
] as const;

const RegisterSchema = z.object({
  username: z.string().min(3, 'At least 3 characters').max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Letters, digits, hyphens, underscores only'),
  email: z.string().email('Valid email required').max(254),
  password: z.string()
    .min(12, 'At least 12 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
  securityQuestion: z.enum(SECURITY_QUESTIONS),
  securityAnswer: z.string().min(2, 'Answer required').max(200),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type RegisterFormData = z.infer<typeof RegisterSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await authService.register({
        username: data.username,
        email: data.email,
        password: data.password,
        securityQuestion: data.securityQuestion,
        securityAnswer: data.securityAnswer,
      });
      navigate('/login', { state: { message: 'Account created! Please log in.' } });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create an account</h1>

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={void handleSubmit(onSubmit)} className="space-y-4">
          {[
            { id: 'username', label: 'Username', type: 'text', autoComplete: 'username', field: 'username' as const },
            { id: 'email', label: 'Email', type: 'email', autoComplete: 'email', field: 'email' as const },
            { id: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', field: 'password' as const },
            { id: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password', field: 'confirmPassword' as const },
          ].map(({ id, label, type, autoComplete, field }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                id={id}
                type={type}
                autoComplete={autoComplete}
                {...register(field)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors[field] && <p className="text-xs text-red-600 mt-1">{errors[field]?.message}</p>}
            </div>
          ))}

          <div>
            <label htmlFor="securityQuestion" className="block text-sm font-medium text-gray-700 mb-1">Security question</label>
            <select
              id="securityQuestion"
              {...register('securityQuestion')}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a question…</option>
              {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            {errors.securityQuestion && <p className="text-xs text-red-600 mt-1">{errors.securityQuestion.message}</p>}
          </div>

          <div>
            <label htmlFor="securityAnswer" className="block text-sm font-medium text-gray-700 mb-1">Security answer</label>
            <input
              id="securityAnswer"
              type="text"
              autoComplete="off"
              {...register('securityAnswer')}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.securityAnswer && <p className="text-xs text-red-600 mt-1">{errors.securityAnswer.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded text-sm font-medium"
          >
            {isSubmitting ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-500">
          Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
