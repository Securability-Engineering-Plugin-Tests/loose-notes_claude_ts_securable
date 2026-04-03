/**
 * Password recovery flow (two-step).
 *
 * SSEM: Confidentiality — password is NEVER returned to the user.
 * PRD §4.3 required displaying the current password in plaintext.
 *
 * Step 1: Enter email → server returns security question
 * Step 2: Answer question + set new password → server validates and updates
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../services/authService';
import { ApiError } from '../services/api';

const Step1Schema = z.object({ email: z.string().email('Valid email required') });
type Step1Data = z.infer<typeof Step1Schema>;

const Step2Schema = z.object({
  securityAnswer: z.string().min(1, 'Answer required').max(200),
  newPassword: z.string().min(12, 'At least 12 characters').max(128),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type Step2Data = z.infer<typeof Step2Schema>;

export default function PasswordRecoveryPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [securityQuestion, setSecurityQuestion] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const step1Form = useForm<Step1Data>({ resolver: zodResolver(Step1Schema) });
  const step2Form = useForm<Step2Data>({ resolver: zodResolver(Step2Schema) });

  const onStep1Submit = async (data: Step1Data) => {
    setError(null);
    try {
      const result = await authService.forgotPassword(data.email);
      if (result.securityQuestion && result.resetToken) {
        setSecurityQuestion(result.securityQuestion);
        setResetToken(result.resetToken);
        setStep(2);
      } else {
        // Generic message to prevent email enumeration
        setSuccessMessage(result.message);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed. Try again.');
    }
  };

  const onStep2Submit = async (data: Step2Data) => {
    if (!resetToken) return;
    setError(null);
    try {
      const result = await authService.resetPassword({
        token: resetToken,
        securityAnswer: data.securityAnswer,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      setSuccessMessage(result.message);
      setStep(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed. Try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Recover your password</h1>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            {successMessage}
            {' '}<Link to="/login" className="underline">Log in</Link>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
        )}

        {step === 1 && !successMessage && (
          <form onSubmit={void step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
            <p className="text-sm text-gray-500">Enter your registered email address to begin.</p>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="email" type="email" autoComplete="email" {...step1Form.register('email')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {step1Form.formState.errors.email && <p className="text-xs text-red-600 mt-1">{step1Form.formState.errors.email.message}</p>}
            </div>
            <button type="submit" disabled={step1Form.formState.isSubmitting} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded text-sm font-medium">
              {step1Form.formState.isSubmitting ? 'Sending…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && securityQuestion && (
          <form onSubmit={void step2Form.handleSubmit(onStep2Submit)} className="space-y-4">
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
              {/* Security question rendered via JSX — escaped */}
              <strong>Security question:</strong> {securityQuestion}
            </div>
            <div>
              <label htmlFor="securityAnswer" className="block text-sm font-medium text-gray-700 mb-1">Your answer</label>
              <input id="securityAnswer" type="text" autoComplete="off" {...step2Form.register('securityAnswer')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              {step2Form.formState.errors.securityAnswer && <p className="text-xs text-red-600 mt-1">{step2Form.formState.errors.securityAnswer.message}</p>}
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input id="newPassword" type="password" autoComplete="new-password" {...step2Form.register('newPassword')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              {step2Form.formState.errors.newPassword && <p className="text-xs text-red-600 mt-1">{step2Form.formState.errors.newPassword.message}</p>}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input id="confirmPassword" type="password" autoComplete="new-password" {...step2Form.register('confirmPassword')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              {step2Form.formState.errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{step2Form.formState.errors.confirmPassword.message}</p>}
            </div>
            <button type="submit" disabled={step2Form.formState.isSubmitting} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded text-sm font-medium">
              {step2Form.formState.isSubmitting ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-center text-gray-500">
          <Link to="/login" className="text-brand-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
